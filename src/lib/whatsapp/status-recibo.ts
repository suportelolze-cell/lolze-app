/**
 * Regra de status dos recibos do WhatsApp Cloud (PURO, sem I/O). Um recibo
 * (sent/delivered/read) NUNCA rebaixa o estado da mensagem — recibos chegam
 * fora de ordem e podem repetir. Extraído do webhook para ter teste de
 * regressão (fluxo crítico de mensageria; dossiê §4.1/§14).
 */

/** Tipo do recibo do provedor → status interno. */
export const MAPA_RECIBO_WA: Record<string, string> = {
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
};

/** De quais status ATUAIS o alvo pode avançar (hierarquia: nunca rebaixa). */
export const STATUS_ANTERIORES: Record<string, string[]> = {
  enviada: ["pendente"],
  entregue: ["pendente", "enviada"],
  lida: ["pendente", "enviada", "entregue"],
};

/** Status interno-alvo de um tipo de recibo, ou null se o tipo for desconhecido. */
export function statusDoRecibo(tipo: string): string | null {
  return MAPA_RECIBO_WA[tipo] ?? null;
}

/**
 * Dado o status ATUAL da mensagem e o tipo do recibo, devolve o novo status se
 * for um avanço válido, ou null para IGNORAR (tipo desconhecido, recibo fora de
 * ordem que rebaixaria, ou repetido no mesmo estado). "failed" é tratado à parte
 * no webhook (vira 'falhou' com o motivo) e não passa por aqui.
 */
export function promoverPorRecibo(atual: string, tipoRecibo: string): string | null {
  const novo = statusDoRecibo(tipoRecibo);
  if (!novo) return null;
  return (STATUS_ANTERIORES[novo] ?? []).includes(atual) ? novo : null;
}
