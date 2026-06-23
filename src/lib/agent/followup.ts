import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { getAnthropic, temChaveIA, SDR_MODEL } from "./anthropic";

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

export const CADENCIA_MIN = [60, 240, 1440, 4320]; // +1h, +4h, +1d, +3d
export const REATIVACAO_MIN = [21600, 43200, 64800]; // +15d, +30d, +45d

function ts(minutos: number) {
  return new Date(Date.now() + minutos * 60000).toISOString();
}

/** Agenda o 1º toque da cadência (chamado logo após a IA responder). */
export function primeiroFollowup() {
  return { proximo: ts(CADENCIA_MIN[0]), modo: "cadencia" as const, count: 0 };
}

/** Agenda reativação manual (lead pediu pra falar depois). */
export function agendarReativacao(dias: number) {
  return { proximo: ts(Math.max(1, dias) * 1440), modo: "reativacao" as const, count: 0 };
}

/** Calcula o próximo passo depois de enviar um toque em (modo, count). */
export function avancar(
  modo: string | null,
  count: number
): { proximo: string | null; modo: string | null; count: number } {
  const novo = count + 1;
  if (modo === "cadencia") {
    if (novo < CADENCIA_MIN.length) return { proximo: ts(CADENCIA_MIN[novo]), modo: "cadencia", count: novo };
    return { proximo: ts(REATIVACAO_MIN[0]), modo: "reativacao", count: 0 }; // cadência → reativação
  }
  if (modo === "reativacao") {
    if (novo < REATIVACAO_MIN.length) return { proximo: ts(REATIVACAO_MIN[novo]), modo: "reativacao", count: novo };
    return { proximo: null, modo: null, count: novo }; // fim da régua
  }
  return { proximo: null, modo: null, count: novo };
}

type LeadFu = {
  id: number;
  nome: string | null;
  canal: string | null;
  coluna: string | null;
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
    .select("id,nome,canal,coluna,atendente_id,comando,followup_modo,followup_count")
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
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

  const system =
    `Você é o SDR de ${str("nome_negocio") || "nossa empresa"}. ` +
    `Tom de voz: ${str("tom") || "humano, cordial e consultivo"}. ` +
    `Oferta: ${str("oferta") || "(não informada)"}. ` +
    `Regras: ${str("regras") || "—"}.\n\n` +
    (reativacao
      ? "[REATIVAÇÃO] Faz um tempo que este lead não fala com a gente. Reabra a conversa de forma calorosa e leve, como quem retoma um papo, trazendo um motivo/benefício novo. Sem cobrança."
      : "[FOLLOW-UP] O lead parou de responder e ainda não recusou nem fechou. Dê um toque gentil para reengajar.") +
    " Envie UMA mensagem curta (1–2 linhas), natural e humana, que agregue valor e faça uma pergunta simples pra ele voltar a responder. Não seja insistente, não repita o que já disse, não invente preço nem prometa resultado.";

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
  } catch {
    // falha de IA: reprograma pra tentar no próximo ciclo (não consome o toque)
    return;
  }

  if (texto) {
    await admin
      .from("app_mensagens")
      .insert({ tenant_id: tenantId, lead_id: leadId, autor: "ia", texto });
    await dispatchOutbound(tenantId, leadId, texto);
  }

  // Avança a régua (ou encerra).
  const prox = avancar(modo, lead.followup_count ?? 0);
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
