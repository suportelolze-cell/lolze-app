/**
 * Detecção de erro "coluna não existe" do PostgREST/Postgres — usado para
 * degradar de forma segura quando uma migração aditiva ainda não foi aplicada
 * em produção (o código lê/escreve a coluna nova; sem ela, cai para o legado).
 *
 * PostgREST responde diferente por verbo: SELECT relaia o Postgres (code 42703,
 * "... does not exist"); UPDATE/INSERT valida o body contra o schema cache ANTES
 * (code PGRST204, "... in the schema cache"). Cobrimos os dois códigos + a
 * mensagem. Núcleo PURO (sem `@/`) para ser testável.
 */
export function colunaAusente(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /does not exist|schema cache/i.test(error.message ?? "");
}
