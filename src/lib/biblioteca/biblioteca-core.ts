/**
 * Núcleo PURO da biblioteca de mídia (sem `@/`, sem I/O). Formata a lista de
 * arquivos disponíveis para o system prompt do SDR. Testável via `node --test`.
 */

export type ArquivoPrompt = { id: string; nome: string; quandoUsar: string };

/** Bloco do prompt que ensina a IA quais arquivos existem e quando enviar. */
export function formatarBibliotecaParaPrompt(arquivos: ArquivoPrompt[]): string {
  if (!arquivos.length) return "";
  const linhas = arquivos.map(
    (a) => `- id=${a.id} — ${a.nome}${a.quandoUsar ? ` — enviar quando: ${a.quandoUsar}` : ""}`
  );
  return `# Arquivos que você pode enviar
Você pode ENVIAR estes arquivos prontos ao lead com a ferramenta enviar_arquivo, passando o 'id' EXATO. Envie só quando ajudar DE VERDADE o próximo passo (ex.: o lead pediu a tabela de preços, quer ver fotos, ou perguntou onde fica). No máximo 1 por mensagem; NUNCA envie o mesmo arquivo duas vezes.
${linhas.join("\n")}`;
}
