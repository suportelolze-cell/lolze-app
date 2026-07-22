/**
 * Cadência do follow-up (PURO, sem I/O) — os gaps entre toques e a transição
 * cadência → reativação → fim. Separado de followup.ts para ter teste de
 * regressão sobre a sequência: é o que garante que o lead recebe os toques
 * certos, na ordem certa, e que a régua termina (não fica em loop).
 *
 * - CADÊNCIA (silêncio numa conversa ativa): 4 toques — +1h, +4h, +1d, +3d.
 * - REATIVAÇÃO (sumiu de vez): 3 toques longos — +15d, +30d, +45d.
 */

export const CADENCIA_MIN = [60, 240, 1440, 4320]; // +1h, +4h, +1d, +3d
export const REATIVACAO_MIN = [21600, 43200, 64800]; // +15d, +30d, +45d

export function ts(minutos: number) {
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
