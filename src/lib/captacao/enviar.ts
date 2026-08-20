import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getAnthropic, temChaveIA, ROUTER_MODEL } from "@/lib/agent/anthropic";
import { enviarTexto } from "@/lib/evolution/client";
import { registrarUsoIA } from "@/lib/agent/uso";
import { registrarErro } from "@/lib/observability/erros";
import { renderTemplate, erroDeColunaAusente } from "./captacao-core";

/**
 * Prospecção Assistida (Parte A) — envio automático em BAIXO volume.
 *
 * Para cada tenant com captação ligada, pega poucos prospects "novo", a IA
 * escreve uma abordagem personalizada e envia UMA mensagem pelo número
 * DEDICADO (prospect_instancia). Um toque por prospect — sem repetição.
 * Quem responde vira lead normal e cai no SDR (que qualifica e agenda).
 */

const MAX_GLOBAL = 10; // teto de envios por rodada do cron (protege o número + o tempo)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CfgProsp = {
  tenant_id: string;
  prospect_instancia: string | null;
  prospect_dia: number | null;
  nome_negocio: string | null;
  oferta: string | null;
  tom: string | null;
  prospect_modo?: string | null; // 'ia' (IA redige) | 'texto' (disparo do gestor)
  prospect_mensagem?: string | null; // texto do disparo quando modo='texto'
};

type ProspAlvo = {
  id: number;
  nome_empresa: string | null;
  telefone: string;
  site: string | null;
  nicho: string | null;
  cidade: string | null;
};

/** Gera a mensagem de abertura (fria) para uma empresa, no tom do tenant. */
export async function gerarAbordagem(cfg: CfgProsp, p: ProspAlvo): Promise<string> {
  const client = getAnthropic();
  const system = `Você é o SDR de ${cfg.nome_negocio || "nossa empresa"}. Tom: ${
    cfg.tom || "consultivo, humano e caloroso"
  }. O que oferecemos: ${cfg.oferta || "(não informado)"}.

Escreva a PRIMEIRA mensagem de WhatsApp para uma empresa que ainda NÃO te conhece (prospecção fria). Regras:
- 2 a 4 linhas, humano e ESPECÍFICO ao negócio dela (use o nome/nicho/cidade quando fizer sentido).
- Desperte curiosidade e conexão; NÃO tente vender de cara.
- NUNCA fale preço, plano ou valor.
- Termine com UMA pergunta leve que convide a responder.
- Nada de parecer template/spam. Português do Brasil, sem markdown.
- Sem travessão nem meia-risca (os traços "—"/"–"); use vírgula, ponto ou dois-pontos.`;
  const user = `Empresa: ${p.nome_empresa || "(sem nome)"} | Nicho: ${p.nicho || "—"} | Cidade: ${
    p.cidade || "—"
  } | Site: ${p.site || "—"}. Escreva apenas a mensagem, sem aspas.`;

  const res = await client.messages.create({
    model: ROUTER_MODEL, // Haiku — barato para volume
    max_tokens: 220,
    system,
    messages: [{ role: "user", content: user }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  await registrarUsoIA(cfg.tenant_id, {
    inputTokens: res.usage.input_tokens ?? 0,
    outputTokens: res.usage.output_tokens ?? 0,
    cacheCreation: res.usage.cache_creation_input_tokens ?? 0,
    cacheRead: res.usage.cache_read_input_tokens ?? 0,
  });

  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .trim();
}

/** Rodada de prospecção (chamada pelo cron). Best-effort, idempotente. */
export async function processarCaptacao(): Promise<{ enviados: number }> {
  if (!temChaveIA()) return { enviados: 0 };
  const admin = getCrmAdmin();

  // Select defensivo: tenta com as colunas do modo de disparo. Só cai para o
  // legado (tudo 'ia') quando a coluna está AUSENTE (migração pendente). Num erro
  // transitório NÃO rebaixamos 'texto'→'ia' (enviaria a mensagem errada, e o
  // envio é irreversível) — pulamos a rodada e tentamos de novo no próximo cron.
  const comModo = await admin
    .from("app_config")
    .select("tenant_id,prospect_instancia,prospect_dia,nome_negocio,oferta,tom,prospect_modo,prospect_mensagem")
    .eq("prospect_ativo", true);
  let cfgs: Record<string, unknown>[] | null = comModo.data;
  if (comModo.error) {
    if (erroDeColunaAusente(comModo.error)) {
      cfgs = (
        await admin
          .from("app_config")
          .select("tenant_id,prospect_instancia,prospect_dia,nome_negocio,oferta,tom")
          .eq("prospect_ativo", true)
      ).data;
    } else {
      cfgs = null; // erro transitório: pula a rodada sem downgrade
    }
  }

  let enviados = 0;
  const hoje0 = new Date();
  hoje0.setUTCHours(0, 0, 0, 0);

  for (const c of (cfgs ?? []) as CfgProsp[]) {
    if (enviados >= MAX_GLOBAL) break;
    const inst = (c.prospect_instancia || "").trim();
    if (!inst) continue;

    const modo = c.prospect_modo === "texto" ? "texto" : "ia";
    const template = (c.prospect_mensagem || "").trim();
    // Disparo por texto sem texto salvo: não manda nada em branco — pula o tenant.
    if (modo === "texto" && !template) continue;

    const porDia = Math.min(Math.max(Number(c.prospect_dia) || 10, 1), 40);
    const { count: jaHoje } = await admin
      .from("app_prospects")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", c.tenant_id)
      .eq("status", "enviado")
      .gte("enviado_at", hoje0.toISOString());

    const restante = Math.min(porDia - (jaHoje ?? 0), MAX_GLOBAL - enviados);
    if (restante <= 0) continue;

    const { data: fila } = await admin
      .from("app_prospects")
      .select("id,nome_empresa,telefone,site,nicho,cidade")
      .eq("tenant_id", c.tenant_id)
      .eq("status", "novo")
      .order("created_at", { ascending: true })
      .limit(restante);

    for (const p of (fila ?? []) as ProspAlvo[]) {
      try {
        // Modo 'texto': o gestor redige (sem IA/custo). Modo 'ia': a IA redige.
        const msg = modo === "texto" ? renderTemplate(template, p) : await gerarAbordagem(c, p);
        // Render vazio (ex.: template com só {nome} e prospect sem nome): não é
        // falha de ENVIO — não tenta e não marca 'erro'. Deixa 'novo' e segue.
        if (modo === "texto" && !msg) continue;
        const ok = msg ? await enviarTexto(inst, p.telefone, msg) : false;
        if (ok) {
          await admin
            .from("app_prospects")
            .update({
              status: "enviado",
              mensagem: msg,
              enviado_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.id);
          enviados++;
        } else {
          await admin
            .from("app_prospects")
            .update({ status: "erro", erro: "falha no envio", updated_at: new Date().toISOString() })
            .eq("id", p.id);
        }
      } catch (e) {
        await registrarErro({ tenantId: c.tenant_id, contexto: "captacao.envio", erro: e });
        await admin
          .from("app_prospects")
          .update({ status: "erro", erro: String((e as Error).message).slice(0, 300), updated_at: new Date().toISOString() })
          .eq("id", p.id);
      }
      // Espaçamento "humano" entre os envios (reduz risco de bloqueio).
      await sleep(500 + Math.floor(Math.random() * 1200));
      if (enviados >= MAX_GLOBAL) break;
    }
  }

  return { enviados };
}
