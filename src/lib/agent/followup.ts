import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { getAnthropic, temChaveIA, SDR_MODEL } from "./anthropic";
import { registrarUsoIA } from "./uso";
import { dentroDoLimiteIA } from "./limite";
import { registrarErro } from "@/lib/observability/erros";

/**
 * Sistema de follow-up automático (cadência + reativação).
 *
 * Lógica (inspirada em cadências de SDR dos melhores players):
 * - CADÊNCIA (lead ficou em silêncio numa conversa ativa): 4 toques com gaps
 *   crescentes — +1h, +4h, +1 dia, +3 dias.
 * - REATIVAÇÃO (lead deu um "não agora" / sumiu após a cadência): 3 toques
 *   longos — +15, +30, +45 dias.
 * - Qualquer resposta do lead reinicia o ciclo. Agendou/ganhou/perdeu ou um
 *   humano assumiu → para. "Não" definitivo (encerrar_lead) → para.
 */

// Cadência (pura, testável) vive em followup-cadencia.ts. Reexporta o que outros
// módulos importam daqui e usa avancar/ts/CADENCIA_MIN internamente.
import { CADENCIA_MIN, avancar, ts } from "./followup-cadencia";
export {
  CADENCIA_MIN,
  REATIVACAO_MIN,
  primeiroFollowup,
  agendarReativacao,
  avancar,
} from "./followup-cadencia";

type LeadFu = {
  id: number;
  nome: string | null;
  canal: string | null;
  coluna: string | null;
  temperatura: string | null;
  atendente_id: string | null;
  comando: string | null;
  followup_modo: string | null;
  followup_count: number | null;
};

/**
 * Gera e envia UM toque de follow-up para um lead (chamado pelo cron).
 * Best-effort: nunca lança; sempre reprograma ou encerra a régua.
 */
export async function enviarFollowup(tenantId: string, leadId: number): Promise<void> {
  const admin = getCrmAdmin();

  const { data } = await admin
    .from("app_leads")
    .select("id,nome,canal,coluna,temperatura,atendente_id,comando,followup_modo,followup_count")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  const lead = data as LeadFu | null;
  if (!lead) return;

  const parar = async () => {
    await admin
      .from("app_leads")
      .update({ proximo_followup: null, followup_modo: null })
      .eq("tenant_id", tenantId)
      .eq("id", leadId);
  };

  // Guardas: lead fechado/perdido, humano no comando, ou IA desligada → para.
  if (
    lead.coluna === "ganho" ||
    lead.coluna === "perdido" ||
    lead.atendente_id ||
    lead.comando === "humano"
  ) {
    return parar();
  }

  const { data: cfg } = await admin
    .from("app_config")
    .select("nome_negocio,oferta,tom,regras,agente_ativo")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const c = (cfg ?? {}) as Record<string, unknown>;
  const ativo = c.agente_ativo === undefined ? true : Boolean(c.agente_ativo);
  if (!ativo || !temChaveIA()) return parar();
  // Trava de custo por plano: estourou o teto de IA do mês → pula o toque agora
  // (não encerra a régua; retoma quando o mês virar ou o teto aumentar).
  if (!(await dentroDoLimiteIA(tenantId))) return;

  // Histórico recente para dar contexto ao toque.
  const { data: msgs } = await admin
    .from("app_mensagens")
    .select("autor,texto")
    .eq("tenant_id", tenantId)
    .eq("lead_id", leadId)
    .order("id", { ascending: false })
    .limit(12);
  const historico = ((msgs ?? []) as { autor: string; texto: string }[]).reverse();

  const modo = lead.followup_modo ?? "cadencia";
  const reativacao = modo === "reativacao";
  const count = lead.followup_count ?? 0;
  const frio = (lead.temperatura ?? "frio") === "frio";
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

  // Bifurcação (Caminho B): no último toque da cadência, se o lead é FRIO/apenas
  // especulou, despede-se com elegância e PARA (não entra na reativação longa).
  const ultimaCadencia = modo === "cadencia" && count >= CADENCIA_MIN.length - 1;
  const despedidaFrio = ultimaCadencia && frio;

  const instrucao = despedidaFrio
    ? "[DESPEDIDA EDUCADA] Não houve retorno e o lead esfriou. Despeça-se com classe: diga que vai pausar os contatos pra não incomodar e deixe a porta aberta pra quando ele precisar. Sem cobrança, sem culpa."
    : reativacao
      ? "[REATIVAÇÃO] Faz um tempo que este lead não fala com a gente. Reabra com leveza, como quem retoma um papo: traga uma novidade/dica/valor do nicho dele. NÃO tente vender direto — o objetivo é reaquecer o relacionamento."
      : frio
        ? "[FOLLOW-UP] O lead sumiu. Dê um toque leve checando se ainda faz sentido continuar a conversa."
        : "[FOLLOW-UP] O lead demonstrou interesse e sumiu. Retome lembrando do benefício que ele curtiu e convide a continuar, sem pressão.";

  const system =
    `Você é o SDR de ${str("nome_negocio") || "nossa empresa"}. ` +
    `Tom de voz: ${str("tom") || "humano, cordial e consultivo"}. ` +
    `Oferta: ${str("oferta") || "(não informada)"}. ` +
    `Regras: ${str("regras") || "—"}.\n\n` +
    instrucao +
    " Envie UMA mensagem curta (1–2 linhas), natural e humana. Não seja insistente, não repita o que já disse, não invente preço nem prometa resultado.";

  const messages: Anthropic.MessageParam[] = [
    ...historico.map((t) => ({
      role: (t.autor === "lead" ? "user" : "assistant") as "user" | "assistant",
      content: t.texto,
    })),
    { role: "user", content: "(gerar agora a mensagem de follow-up para reengajar este lead)" },
  ];
  if (messages[0].role !== "user") messages.unshift({ role: "user", content: "(retomar contato)" });

  let texto = "";
  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: SDR_MODEL,
      max_tokens: 300,
      system,
      messages,
    } as Anthropic.MessageCreateParamsNonStreaming);
    texto = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    await registrarUsoIA(tenantId, {
      inputTokens: res.usage.input_tokens ?? 0,
      outputTokens: res.usage.output_tokens ?? 0,
      cacheCreation: res.usage.cache_creation_input_tokens ?? 0,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
    });
  } catch (e) {
    // falha de IA: reprograma pra tentar no próximo ciclo (não consome o toque)
    await registrarErro({ tenantId, leadId, contexto: "followup", erro: e });
    return;
  }

  if (texto) {
    const { data: msgRow } = await admin
      .from("app_mensagens")
      .insert({ tenant_id: tenantId, lead_id: leadId, autor: "ia", texto })
      .select("id")
      .single();
    const entrega = await dispatchOutbound(
      tenantId,
      leadId,
      texto,
      (msgRow?.id as number | undefined) ?? undefined
    );
    // Entrega falhou (canal externo caiu): NÃO consome o toque. A mensagem já
    // fica com status "falhou" (dispatchOutbound) e visível na tela "Hoje";
    // reprograma um retry curto e sai SEM avançar a régua — assim o cliente não
    // perde um contato de verdade por causa de uma falha de canal. (canal
    // "painel" = sem canal externo → ok:true de propósito, fica só no painel.)
    if (!entrega.ok) {
      await registrarErro({
        tenantId,
        leadId,
        contexto: "followup.entrega",
        erro: entrega.erro ?? "falha na entrega",
        severidade: "media",
      });
      await admin
        .from("app_leads")
        .update({ proximo_followup: ts(60), updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", leadId);
      return;
    }
  }

  // Avança a régua — ou para de vez se foi a despedida do lead frio.
  const prox = despedidaFrio
    ? { proximo: null as string | null, modo: null as string | null, count: count + 1 }
    : avancar(modo, count);
  await admin
    .from("app_leads")
    .update({
      proximo_followup: prox.proximo,
      followup_modo: prox.modo,
      followup_count: prox.count,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);
}
