import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { getAnthropic, temChaveIA, SDR_MODEL } from "./anthropic";
import { registrarUsoIA } from "./uso";
import { dentroDoLimiteIA } from "./limite";
import { registrarErro } from "@/lib/observability/erros";
import { conteudoMensagem } from "./sdr/historico-core";

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
  POSVENDA_MIN,
  RECUPERACAO_MIN,
  primeiroFollowup,
  agendarReativacao,
  enfileirarPosVenda,
  agendarRecuperacao,
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

/** Resultado de um toque: se uma mensagem REAL saiu, e por que não (se não). */
export type ResultadoFollowup = { enviado: boolean; motivo?: string };

/**
 * Gera e envia UM toque de follow-up para um lead (chamado pelo cron e pela
 * ação manual "reativar"). Best-effort: nunca lança; sempre reprograma ou
 * encerra a régua. Retorna se um toque REAL foi enviado — o cron ignora esse
 * retorno (retrocompatível), a ação manual usa para não mostrar sucesso falso.
 */
export async function enviarFollowup(tenantId: string, leadId: number): Promise<ResultadoFollowup> {
  const admin = getCrmAdmin();

  const { data } = await admin
    .from("app_leads")
    .select("id,nome,canal,coluna,temperatura,atendente_id,comando,followup_modo,followup_count")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  const lead = data as LeadFu | null;
  if (!lead) return { enviado: false, motivo: "sem_lead" };

  const parar = async () => {
    await admin
      .from("app_leads")
      .update({ proximo_followup: null, followup_modo: null })
      .eq("tenant_id", tenantId)
      .eq("id", leadId);
  };

  const modo = lead.followup_modo ?? "cadencia";
  const posvenda = modo === "posvenda";

  // Guardas: perdido, humano no comando, ou IA desligada → para. 'ganho' também
  // para — EXCETO na trilha de pós-venda, que existe justamente para o cliente
  // que já fechou (acompanhamento recorrente). E um modo 'posvenda' RESIDUAL num
  // lead que NÃO está mais em 'ganho' (foi movido de volta pro funil) é estado
  // inconsistente → para e limpa (senão mandaria "você já fechou" a quem não fechou).
  if (
    lead.coluna === "perdido" ||
    lead.atendente_id ||
    lead.comando === "humano" ||
    (lead.coluna === "ganho" && !posvenda) ||
    (posvenda && lead.coluna !== "ganho")
  ) {
    await parar();
    return { enviado: false, motivo: "parado" };
  }

  const { data: cfg } = await admin
    .from("app_config")
    .select("nome_negocio,oferta,tom,regras,agente_ativo")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const c = (cfg ?? {}) as Record<string, unknown>;
  const ativo = c.agente_ativo === undefined ? true : Boolean(c.agente_ativo);
  if (!ativo || !temChaveIA()) {
    // IA desligada: PAUSA a pós-venda (não destrói a trilha de um cliente que já
    // pagou — retoma quando religar). Follow-up/reativação normais param mesmo.
    if (posvenda) return { enviado: false, motivo: "ia_off" };
    await parar();
    return { enviado: false, motivo: "ia_off" };
  }
  // Trava de custo por plano: estourou o teto de IA do mês → pula o toque agora
  // (não encerra a régua; retoma quando o mês virar ou o teto aumentar).
  if (!(await dentroDoLimiteIA(tenantId))) return { enviado: false, motivo: "limite" };

  // Histórico recente para dar contexto ao toque.
  const { data: msgs } = await admin
    .from("app_mensagens")
    .select("autor,texto")
    .eq("tenant_id", tenantId)
    .eq("lead_id", leadId)
    .order("id", { ascending: false })
    .limit(12);
  const historico = ((msgs ?? []) as { autor: string; texto: string }[]).reverse();

  const reativacao = modo === "reativacao";
  const recuperacao = modo === "recuperacao";
  const count = lead.followup_count ?? 0;
  const frio = (lead.temperatura ?? "frio") === "frio";
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

  // Bifurcação (Caminho B): no último toque da cadência, se o lead é FRIO/apenas
  // especulou, despede-se com elegância e PARA (não entra na reativação longa).
  const ultimaCadencia = modo === "cadencia" && count >= CADENCIA_MIN.length - 1;
  const despedidaFrio = ultimaCadencia && frio;

  const instrucao = despedidaFrio
    ? "[DESPEDIDA EDUCADA] Não houve retorno e o lead esfriou. Despeça-se com classe: diga que vai pausar os contatos pra não incomodar e deixe a porta aberta pra quando ele precisar. Sem cobrança, sem culpa."
    : recuperacao
      ? "[RECUPERAÇÃO DE VENDA] O cliente gerou um pagamento (PIX/boleto) ou começou a compra e não finalizou. Lembre com gentileza que está quase concluído e ofereça ajuda pra terminar (reenviar o link, tirar uma dúvida). Sem pressão; não invente preço nem link que você não tem. Se ele não tiver mais interesse, agradeça e encerre com leveza."
      : posvenda
      ? "[PÓS-VENDA] Este cliente JÁ fechou/foi atendido — não é mais uma venda em aberto. Faça um acompanhamento genuíno e caloroso: pergunte como foi a experiência e, se fizer sentido, convide a agendar o próximo serviço/retoque. Tom de cuidado e relacionamento, ZERO pressão de venda."
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
      content: conteudoMensagem(t.texto), // nunca vazio (mídia sem legenda)
    })),
    {
      role: "user",
      content: posvenda
        ? "(gerar agora a mensagem de pós-venda / acompanhamento para este cliente)"
        : recuperacao
          ? "(gerar agora a mensagem para ajudar o cliente a finalizar a compra pendente)"
          : "(gerar agora a mensagem de follow-up para reengajar este lead)",
    },
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
    return { enviado: false, motivo: "erro_ia" };
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
      return { enviado: false, motivo: "entrega_falhou" };
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

  // Chegou aqui: mandou de verdade (texto + entrega ok) ou não gerou texto.
  return texto ? { enviado: true } : { enviado: false, motivo: "sem_texto" };
}
