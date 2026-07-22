/**
 * Política de reenvio do outbox (PURA, sem I/O) — quantas vezes reenviar uma
 * mensagem de saída que falhou e com que espaçamento, antes de virar dead-letter.
 *
 * Contexto: dispatchOutbound já retenta DENTRO do request (segundos). Isto é o
 * retry AO LONGO DO TEMPO (canal caído por minutos/horas): o cron reenvia com
 * backoff crescente e, esgotado, marca a mensagem como "morta" para o operador ver.
 */

export const MAX_REENVIOS = 4;

// Espera (min) até o próximo reenvio, indexada por quantos reenvios já foram feitos.
const BACKOFF_MIN = [15, 30, 60, 120];

/** Minutos até a próxima tentativa, dado quantos reenvios já foram feitos. */
export function backoffMin(reenviosFeitos: number): number {
  const i = Math.max(0, Math.min(reenviosFeitos, BACKOFF_MIN.length - 1));
  return BACKOFF_MIN[i];
}

/** Já esgotou os reenvios assíncronos? (vira dead-letter / status "morta") */
export function esgotou(reenviosFeitos: number): boolean {
  return reenviosFeitos >= MAX_REENVIOS;
}

/** ISO de "agora + minutos" (para agendar proxima_tentativa). */
export function emMinutos(minutos: number): string {
  return new Date(Date.now() + minutos * 60000).toISOString();
}
