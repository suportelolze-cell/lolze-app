/**
 * Núcleo PURO da ingestão do Google Ads — sem dependências de `@/` para ser
 * testável com `node --test`. Transforma as linhas da Google Ads API (GAQL,
 * level de conta) nas linhas do app_trafego. Rede/segredos ficam no google-sync.
 */

export type TrafegoDia = {
  dia: string; // YYYY-MM-DD
  cliques: number;
  investimentoCents: number;
  visitantes: number;
};

/** Linha crua da Google Ads API (REST usa lowerCamelCase nos campos). */
export type GoogleAdsRow = {
  segments?: { date?: string };
  metrics?: { costMicros?: string | number; clicks?: string | number };
  customer?: { currencyCode?: string };
};

/**
 * Normaliza o Customer ID para só dígitos (a API espera "1234567890", o cliente
 * costuma ter "123-456-7890"). Devolve "" se não for um id válido de 10 dígitos.
 */
export function normalizarCustomerId(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.length === 10 ? d : "";
}

/** Converte com segurança um campo numérico da API (string | number | ausente). */
function numero(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** GAQL: métricas diárias de custo/cliques da conta na janela [since, until]. */
export function montarGaql(since: string, until: string): string {
  return (
    "SELECT segments.date, metrics.cost_micros, metrics.clicks, customer.currency_code " +
    `FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`
  );
}

/** Moeda observada na resposta (customer.currency_code) — para a guarda de moeda. */
export function moedaDasLinhas(rows: GoogleAdsRow[]): string | null {
  for (const r of rows ?? []) {
    const c = r?.customer?.currencyCode;
    if (c) return c;
  }
  return null;
}

/**
 * Mapeia as linhas (segments.date + metrics) para linhas do app_trafego:
 * - investimentoCents: cost_micros / 10.000 (micros = moeda × 1e6; cents = /1e4).
 * - cliques: metrics.clicks.
 * - visitantes: 0 — o Google Ads (nível conta) não tem um equivalente limpo de
 *   "visitantes únicos da página"; deixamos o funil somar 0 desta fonte.
 * - Linhas sem segments.date válido são descartadas.
 * - Deduplica por dia (última vence) — evita o upsert em lote rejeitar o batch.
 * Todos os números saem >= 0 e inteiros.
 */
export function mapearLinhas(rows: GoogleAdsRow[]): TrafegoDia[] {
  const porDia = new Map<string, TrafegoDia>();
  for (const r of rows ?? []) {
    const dia = String(r?.segments?.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    porDia.set(dia, {
      dia,
      cliques: Math.max(0, Math.round(numero(r.metrics?.clicks))),
      investimentoCents: Math.max(0, Math.round(numero(r.metrics?.costMicros) / 10000)),
      visitantes: 0,
    });
  }
  return [...porDia.values()];
}
