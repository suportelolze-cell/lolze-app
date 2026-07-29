/**
 * Núcleo PURO do histórico do agente (sem `@/`, sem I/O). Testável via node --test.
 */

/**
 * Conteúdo de uma mensagem para a API do modelo. NUNCA pode ser vazio: a API da
 * Anthropic rejeita `content: ''` fora da última posição (HTTP 400), e uma
 * mensagem de MÍDIA sem legenda (arquivo enviado pela IA ou anexo do atendente)
 * grava texto vazio no histórico. Troca vazio por um marcador seguro.
 */
export function conteudoMensagem(texto: string | null | undefined): string {
  return texto && texto.trim() ? texto : "[arquivo/mídia enviado]";
}
