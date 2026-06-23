// Matriz de features por plano (travas). O "motor" (IA SDR, RAG, agenda,
// WhatsApp, CRM, atendimento) está em TODOS os planos e não entra aqui.

export type Feature = "anuncios" | "instagram" | "metaAds";

const MATRIZ: Record<string, Feature[]> = {
  start: [],
  growth: ["anuncios", "instagram"],
  scale: ["anuncios", "instagram", "metaAds"],
};

/** Rótulos amigáveis (usados em mensagens de upsell). */
export const FEATURE_LABEL: Record<Feature, string> = {
  anuncios: "Pago × Orgânico e ranking de anúncios",
  instagram: "Instagram",
  metaAds: "Integração com o gasto do Meta Ads",
};

/**
 * Plano libera a feature?
 * Plano desconhecido = não restringe (evita esconder algo por engano).
 */
export function planoTemFeature(plano: string | null | undefined, f: Feature): boolean {
  const p = (plano || "").toLowerCase();
  if (!(p in MATRIZ)) return true;
  return MATRIZ[p].includes(f);
}

/** Menor plano que libera a feature (para a mensagem "disponível no plano X"). */
export function planoMinimoPara(f: Feature): string {
  if (MATRIZ.growth.includes(f)) return "Growth";
  if (MATRIZ.scale.includes(f)) return "Scale";
  return "Growth";
}
