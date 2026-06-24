import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { getAnthropic, temChaveIA, SDR_MODEL } from "../anthropic";
import { registrarRun } from "../runs";
import type { LeadContexto, PersonaConfig, ResultadoAgente, Turno } from "../types";
import { montarSystemSDR } from "./prompt";
import { SDR_TOOLS, aplicarToolSDR, type SdrPatch } from "./tools";
import { buscarConhecimento } from "@/lib/kb/search";
import { agendarReuniao } from "./agendar";
import { primeiroFollowup } from "../followup";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";

type Admin = ReturnType<typeof getCrmAdmin>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Quebra a resposta da IA em mensagens curtas (mais humano no WhatsApp):
 * separa por parágrafos; parágrafos longos viram frases. Máx. 5 mensagens.
 */
function dividirResposta(texto: string): string[] {
  const blocos = texto.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const partes: string[] = [];
  for (const b of blocos.length ? blocos : [texto.trim()]) {
    if (b.length <= 320) {
      partes.push(b);
      continue;
    }
    const frases = b.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [b];
    let buf = "";
    for (const f of frases) {
      if (buf && (buf + f).length > 320) {
        partes.push(buf.trim());
        buf = f;
      } else {
        buf += f;
      }
    }
    if (buf.trim()) partes.push(buf.trim());
  }
  if (partes.length <= 5) return partes;
  return [...partes.slice(0, 4), partes.slice(4).join(" ")];
}

/** Avisa o contato do cliente (telefone do "Gerenciar") quando a IA escala. */
async function notificarSuporte(admin: Admin, tenantId: string, leadNome: string, motivo?: string) {
  const { data: t } = await admin
    .from("app_tenants")
    .select("contato_telefone")
    .eq("id", tenantId)
    .maybeSingle();
  const numero = (t?.contato_telefone as string | null) ?? "";
  if (!numero) return;
  const { data: sec } = await admin
    .from("app_tenant_secrets")
    .select("evolution_instance")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!temEvolutionConfig() || !sec?.evolution_instance) return;
  const msg =
    `🔔 A IA precisou de ajuda no atendimento de *${leadNome}*.` +
    (motivo ? `\nMotivo: ${motivo}.` : "") +
    `\nEntre na Central de Atendimento para assumir.`;
  await enviarTexto(sec.evolution_instance, numero, msg).catch(() => null);
}

/** Quantos turnos do histórico enviar como contexto (limita custo). */
const MAX_TURNOS = 30;
/** Limite de iterações do loop de ferramentas (evita loop infinito). */
const MAX_ITER = 5;

/** Lê a persona/identidade do tenant. Colunas de persona são opcionais. */
async function carregarConfig(admin: Admin, tenantId: string): Promise<PersonaConfig> {
  const { data } = await admin.from("app_config").select("*").eq("tenant_id", tenantId).maybeSingle();
  const c = (data ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return {
    nomeNegocio: str("nome_negocio"),
    endereco: str("endereco"),
    email: str("email"),
    horario: str("horario"),
    oferta: str("oferta"),
    publico: str("publico"),
    tom: str("tom"),
    regras: str("regras"),
    objecoes: str("objecoes"),
    faq: str("faq"),
    agenteAtivo: c.agente_ativo === undefined ? true : Boolean(c.agente_ativo),
  };
}

type LeadRow = {
  id: number;
  nome: string | null;
  canal: string | null;
  origem: string | null;
  temperatura: LeadContexto["temperatura"];
  coluna: LeadContexto["coluna"];
  diagnostico: string | null;
  comando: string | null;
  precisa_humano: boolean | null;
  atendente_id: string | null;
};

async function carregarLead(admin: Admin, tenantId: string, leadId: number) {
  const { data } = await admin
    .from("app_leads")
    .select("id,nome,canal,origem,temperatura,coluna,diagnostico,comando,precisa_humano,atendente_id")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  return data as LeadRow | null;
}

async function carregarHistorico(admin: Admin, tenantId: string, leadId: number): Promise<Turno[]> {
  const { data } = await admin
    .from("app_mensagens")
    .select("autor,texto,id")
    .eq("tenant_id", tenantId)
    .eq("lead_id", leadId)
    .order("id", { ascending: false })
    .limit(MAX_TURNOS);
  const linhas = (data ?? []) as { autor: Turno["autor"]; texto: string }[];
  return linhas.reverse(); // volta à ordem cronológica
}

/** Converte o histórico (lead/ia/atendente) em mensagens da API (user/assistant). */
function montarMensagens(historico: Turno[]): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = historico.map((t) => ({
    role: t.autor === "lead" ? "user" : "assistant",
    content: t.texto,
  }));
  // A primeira mensagem precisa ser do usuário (lead).
  if (msgs.length === 0 || msgs[0].role !== "user") {
    msgs.unshift({ role: "user", content: "(o lead iniciou o contato)" });
  }
  return msgs;
}

/**
 * Executa um turno do SDR para um lead. Carrega contexto, roda o loop de
 * tool-use do Claude, aplica as mutações no funil, grava a resposta da IA e a
 * entrega ao canal (n8n). Tudo idempotente o suficiente para ser chamado pelo
 * webhook após cada mensagem do lead.
 */
export async function executarSDR(tenantId: string, leadId: number): Promise<ResultadoAgente> {
  if (!temChaveIA()) {
    return { ok: false, resposta: "", acoes: [], skipped: "sem_chave" };
  }

  const admin = getCrmAdmin();
  const [cfg, lead] = await Promise.all([
    carregarConfig(admin, tenantId),
    carregarLead(admin, tenantId, leadId),
  ]);

  if (!lead) return { ok: false, resposta: "", acoes: [], erro: "lead não encontrado" };

  // Guardrails de handoff: humano no comando => IA cala. Respeita a trava de conversa.
  if (lead.atendente_id || lead.comando === "humano" || lead.precisa_humano) {
    return { ok: true, resposta: "", acoes: [], skipped: "humano" };
  }
  if (!cfg.agenteAtivo) {
    return { ok: true, resposta: "", acoes: [], skipped: "agente_inativo" };
  }

  const ctx: LeadContexto = {
    id: lead.id,
    nome: lead.nome ?? "",
    canal: lead.canal ?? "whatsapp",
    origem: lead.origem ?? "site",
    temperatura: lead.temperatura,
    coluna: lead.coluna,
    diagnostico: lead.diagnostico ?? "",
  };

  const system = montarSystemSDR(cfg, ctx);
  const messages = montarMensagens(await carregarHistorico(admin, tenantId, leadId));

  const client = getAnthropic();
  const acc: SdrPatch = { patch: {}, acoes: [] };
  let resposta = "";
  const uso = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };
  const inicio = Date.now();

  try {
    for (let i = 0; i < MAX_ITER; i++) {
      const res = await client.messages.create({
        model: SDR_MODEL,
        max_tokens: 1024,
        system,
        output_config: { effort: "low" },
        tools: SDR_TOOLS,
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming);

      uso.inputTokens += res.usage.input_tokens ?? 0;
      uso.outputTokens += res.usage.output_tokens ?? 0;
      uso.cacheCreation += res.usage.cache_creation_input_tokens ?? 0;
      uso.cacheRead += res.usage.cache_read_input_tokens ?? 0;

      const texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (texto) resposta = texto;

      if (res.stop_reason !== "tool_use") break;

      // Executa as ferramentas e devolve os resultados para o modelo continuar.
      messages.push({ role: "assistant", content: res.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          let confirm: string;
          const args = block.input as Record<string, unknown>;
          if (block.name === "buscar_conhecimento") {
            try {
              confirm = await buscarConhecimento(tenantId, String(args.consulta ?? ""));
            } catch (e) {
              confirm = "Base de conhecimento indisponível: " + (e as Error).message;
            }
          } else if (block.name === "agendar_reuniao") {
            try {
              confirm = await agendarReuniao(tenantId, leadId, args);
              acc.acoes.push({ tipo: "mover_etapa", etapa: "agendado", motivo: "agendamento criado" });
            } catch (e) {
              confirm = "Não consegui agendar agora: " + (e as Error).message;
            }
          } else {
            confirm = aplicarToolSDR(block.name, args, acc);
          }
          resultados.push({ type: "tool_result", tool_use_id: block.id, content: confirm });
        }
      }
      messages.push({ role: "user", content: resultados });
    }
  } catch (e) {
    const erro = e instanceof Error ? e.message : "erro desconhecido";
    await registrarRun({
      tenantId,
      leadId,
      agente: "sdr",
      modelo: SDR_MODEL,
      acoes: acc.acoes,
      resposta: "",
      erro,
      uso,
      latenciaMs: Date.now() - inicio,
    });
    return { ok: false, resposta: "", acoes: acc.acoes, erro };
  }

  // Follow-up automático: se a IA respondeu e o lead segue aberto, agenda o
  // próximo toque (a menos que uma tool já tenha definido adiar/encerrar/escalar).
  if (!acc.followupDefinido && resposta) {
    const colFinal = (acc.patch.coluna as string | undefined) ?? lead.coluna;
    const aberto =
      colFinal !== "ganho" &&
      colFinal !== "perdido" &&
      colFinal !== "atencao" &&
      colFinal !== "agendado" &&
      !acc.patch.precisa_humano;
    if (aberto) {
      const fu = primeiroFollowup();
      acc.patch.proximo_followup = fu.proximo;
      acc.patch.followup_modo = fu.modo;
      acc.patch.followup_count = fu.count;
    }
  }

  // Aplica mutações no lead (temperatura/etapa/diagnóstico/escala) num único update.
  if (Object.keys(acc.patch).length > 0) {
    acc.patch.updated_at = new Date().toISOString();
    await admin.from("app_leads").update(acc.patch).eq("tenant_id", tenantId).eq("id", leadId);
  }

  // Se a IA escalou (não tinha a info / vai confirmar com a equipe), avisa o
  // contato do cliente (telefone do "Gerenciar") por WhatsApp.
  if (acc.patch.precisa_humano === true) {
    const escala = acc.acoes.find((a) => a.tipo === "escalar_humano") as { motivo?: string } | undefined;
    await notificarSuporte(admin, tenantId, lead.nome ?? "um lead", escala?.motivo).catch(() => {});
  }

  // Grava e entrega a resposta — em PARTES, com pausas, pra parecer humano.
  if (resposta) {
    const partes = dividirResposta(resposta);
    for (let i = 0; i < partes.length; i++) {
      const parte = partes[i];
      await admin
        .from("app_mensagens")
        .insert({ tenant_id: tenantId, lead_id: leadId, autor: "ia", texto: parte });
      await dispatchOutbound(tenantId, leadId, parte);
      if (i < partes.length - 1) await sleep(Math.min(2600, 700 + parte.length * 18));
    }
  }

  const latenciaMs = Date.now() - inicio;
  await registrarRun({
    tenantId,
    leadId,
    agente: "sdr",
    modelo: SDR_MODEL,
    acoes: acc.acoes,
    resposta,
    uso,
    latenciaMs,
  });

  return { ok: true, resposta, acoes: acc.acoes, uso, latenciaMs };
}
