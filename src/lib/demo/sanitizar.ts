/**
 * Sanitização do histórico do chat de DEMONSTRAÇÃO público (sem I/O, testável).
 *
 * O endpoint /api/demo/chat é público e chama um modelo pago; o cliente controla
 * o array de mensagens. Estas regras limitam o que vira prompt — teto de
 * histórico, teto de caracteres por mensagem, só papéis válidos, e a conversa
 * sempre começa no primeiro "user" — para conter custo e evitar injeção de
 * papéis. Extraído do route para ter teste de regressão.
 */

export const MAX_TURNOS = 7; // perguntas do visitante antes de encerrar o demo
export const MAX_CHARS = 400; // por mensagem
export const MAX_HIST = 14; // últimas mensagens consideradas

export type MsgDemo = { role: "user" | "assistant"; content: string };

/**
 * Limpa o histórico bruto vindo do cliente: mantém só as últimas MAX_HIST
 * mensagens, só papéis user/assistant, conteúdo truncado em MAX_CHARS e não
 * vazio, e descarta o prefixo até o primeiro "user" (a conversa começa nele).
 */
export function sanitizarMensagensDemo(bruto: unknown): MsgDemo[] {
  const lista = Array.isArray(bruto) ? bruto : [];
  const limpo: MsgDemo[] = [];
  for (const m of lista.slice(-MAX_HIST)) {
    const role = (m as { role?: string })?.role;
    const content = String((m as { content?: unknown })?.content ?? "")
      .slice(0, MAX_CHARS)
      .trim();
    if ((role === "user" || role === "assistant") && content) {
      limpo.push({ role, content });
    }
  }
  const primeiroUser = limpo.findIndex((m) => m.role === "user");
  return primeiroUser >= 0 ? limpo.slice(primeiroUser) : [];
}

/** Conta os turnos do visitante (mensagens de user) na conversa sanitizada. */
export function contarTurnos(msgs: MsgDemo[]): number {
  return msgs.filter((m) => m.role === "user").length;
}
