/**
 * Núcleo PURO da ingestão do Meta Ads — sem dependências de `@/` para ser
 * testável com `node --test` (as regras de negócio ficam aqui; rede e segredos
 * ficam no meta-sync.ts). Só transforma os "insights" crus da Marketing API
 * nas linhas do app_trafego.
 */

export type TrafegoDia = {
  dia: string; // YYYY-MM-DD
  cliques: number;
  investimentoCents: number;
  visitantes: number;
};

/** Insight cru relevante da Marketing API (só os campos que pedimos). */
export type MetaInsight = {
  date_start?: string;
  spend?: string | number;
  inline_link_clicks?: string | number;
  actions?: { action_type?: string; value?: string | number }[];
  account_currency?: string;
};

/**
 * Normaliza o Ad Account ID para o formato que a Graph API espera (`act_<id>`).
 * Aceita com ou sem o prefixo. Devolve "" se não for um id válido (só dígitos),
 * para o chamador tratar como "não configurado" em vez de montar uma URL quebrada.
 */
export function normalizarAdAccountId(raw: string): string {
  const limpo = (raw || "").trim();
  if (!limpo) return "";
  const semPrefixo = limpo.replace(/^act_/i, "");
  if (!/^\d+$/.test(semPrefixo)) return "";
  return `act_${semPrefixo}`;
}

/** Converte com segurança um campo numérico da API (string | number | ausente). */
function numero(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** Extrai (>=0, inteiro) o valor de um action_type específico do array `actions`. */
function valorAcao(actions: MetaInsight["actions"], tipo: string): number {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find((x) => x?.action_type === tipo);
  return a ? Math.max(0, Math.round(numero(a.value))) : 0;
}

/**
 * Mapeia os insights diários (level=account, time_increment=1) para linhas do
 * app_trafego. Regras:
 * - cliques: SOMENTE `inline_link_clicks` (cliques que levam ao site). Ausente
 *   => 0. NÃO caímos para `clicks` (total): o Meta omite inline_link_clicks num
 *   dia com 0 cliques de link, e `clicks` inclui curtidas/reações/comentários —
 *   inflaria o topo do funil com cliques que não vão ao site.
 * - investimentoCents: round(spend * 100). A MOEDA é validada no meta-sync
 *   (só BRL é ingerido; conta em outra moeda é pulada e reportada).
 * - visitantes: `landing_page_views` (quem chegou na página); 0 se ausente.
 * - Linhas sem `date_start` válido são descartadas (não dá pra datar).
 * - Deduplica por `dia` (última linha vence): duas linhas do mesmo dia no lote
 *   fariam o upsert com onConflict rejeitar o batch INTEIRO ("cannot affect row
 *   a second time"), zerando a gravação do tenant naquela rodada.
 * Todos os números saem >= 0 e inteiros (o schema é integer não-negativo).
 */
export function mapearInsights(rows: MetaInsight[]): TrafegoDia[] {
  const porDia = new Map<string, TrafegoDia>();
  for (const r of rows ?? []) {
    const dia = String(r?.date_start ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;

    porDia.set(dia, {
      dia,
      cliques: Math.max(0, Math.round(numero(r.inline_link_clicks))),
      investimentoCents: Math.max(0, Math.round(numero(r.spend) * 100)),
      visitantes: valorAcao(r.actions, "landing_page_views"),
    });
  }
  return [...porDia.values()];
}

/**
 * Janela de sincronização: dos últimos `dias` até hoje (inclusive), em YMD.
 * Reprocessamos alguns dias porque o Meta revisa gasto/conversões
 * retroativamente; o upsert idempotente sobrescreve sem duplicar. `hojeYMD`
 * entra por parâmetro (puro/testável, sem depender do relógio).
 */
export function janelaSync(hojeYMD: string, dias: number): { since: string; until: string } {
  const [y, m, d] = hojeYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  base.setUTCDate(base.getUTCDate() - Math.max(0, (dias || 1) - 1));
  return { since: base.toISOString().slice(0, 10), until: hojeYMD };
}
