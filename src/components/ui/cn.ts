/** Junta classes condicionais (sem dependência externa). */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}
