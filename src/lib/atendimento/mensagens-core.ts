/**
 * Núcleo PURO (sem `@/`, sem I/O). Testável via node --test.
 */

/**
 * Mescla duas listas de itens por `id`, deduplicando: os itens de `recentes`
 * sobrescrevem os de `antigas` (mesmo id) — as recentes trazem o status de
 * entrega mais atual. Resultado ordenado por id crescente (cronológico).
 * Usado na Central para unir o histórico completo (carregado ao abrir) com as
 * últimas mensagens ao vivo (poll/realtime).
 */
export function mesclarPorId<T extends { id: number }>(antigas: T[], recentes: T[]): T[] {
  const mapa = new Map<number, T>();
  for (const x of antigas) mapa.set(x.id, x);
  for (const x of recentes) mapa.set(x.id, x);
  return Array.from(mapa.values()).sort((a, b) => a.id - b.id);
}
