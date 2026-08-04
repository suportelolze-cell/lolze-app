/**
 * Referral do Click-to-WhatsApp (Cloud API) — núcleo PURO (sem `@/`), testável.
 *
 * Quando um lead clica num anúncio da Meta que abre o WhatsApp, a PRIMEIRA
 * mensagem traz este objeto em `messages[].referral`. Usamos para atribuir o
 * lead ao anúncio de origem (tráfego pago vs orgânico + qual anúncio). A
 * Evolution já faz isso via `contextInfo.externalAdReply` (shape do Baileys);
 * aqui é o equivalente para a API oficial.
 */

export type ReferralWaCloud = {
  source_id?: string;
  source_type?: string;
  source_url?: string;
  headline?: string;
  body?: string;
  ctwa_clid?: string;
};

/**
 * Rótulo do anúncio de origem a partir do referral. Devolve `null` quando o lead
 * NÃO veio de anúncio (sem referral). O formato espelha EXATAMENTE o do
 * externalAdReply da Evolution (`title || sourceId || sourceUrl || "anúncio"`)
 * para o ranking topAnuncios NÃO fragmentar o mesmo anúncio entre os dois canais
 * (o dashboard agrupa por string exata de app_leads.anuncio). O `ctwa_clid`
 * (click id do Click-to-WhatsApp) conta como sinal de tráfego pago mesmo quando
 * o referral não traz título/id/url.
 */
export function anuncioDoReferral(ref: ReferralWaCloud | null | undefined): string | null {
  if (!ref || typeof ref !== "object") return null;
  const titulo = (ref.headline || "").trim();
  const id = (ref.source_id || "").trim();
  const url = (ref.source_url || "").trim();
  const temReferral = Boolean(
    titulo || id || url || (ref.source_type || "").trim() || (ref.ctwa_clid || "").trim()
  );
  if (!temReferral) return null;
  return titulo || id || url || "anúncio";
}
