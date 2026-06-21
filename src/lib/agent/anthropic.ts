import Anthropic from "@anthropic-ai/sdk";

/**
 * Cérebro de IA do ecossistema Lolze — SERVER-ONLY.
 *
 * Os três agentes (SDR, Agendador, Suporte) chamam a API da Anthropic por aqui.
 * A chave (ANTHROPIC_API_KEY) nunca vai para o browser. Importe isto apenas de
 * server actions / route handlers.
 */

/** Modelo do SDR: melhor equilíbrio inteligência/custo para vender em escala. */
export const SDR_MODEL = "claude-sonnet-4-6";

/** Modelo de roteamento/triagem e tarefas simples e sensíveis a latência. */
export const ROUTER_MODEL = "claude-haiku-4-5";

let _client: Anthropic | null = null;

/** Indica se a chave da Anthropic está configurada (para degradar com elegância). */
export function temChaveIA() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Cliente singleton da Anthropic. Lança se a chave não estiver no ambiente. */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ausente. Cole a chave da Anthropic no .env.local para ligar os agentes de IA."
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
