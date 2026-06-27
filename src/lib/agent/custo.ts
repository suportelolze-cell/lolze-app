/**
 * Cálculo de custo da IA (Anthropic) a partir do uso de tokens.
 *
 * Preço do modelo do SDR (claude-sonnet-4-6), em USD por 1 milhão de tokens:
 *   input  $3.00 · output $15.00 · cache-write $3.75 (1.25x) · cache-read $0.30 (0.1x)
 * Converte para centavos de BRL usando uma taxa configurável (USD_BRL, padrão 5.40).
 */

export type UsoTokens = {
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
};

const USD_POR_TOKEN = {
  input: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
  cacheCreation: 3.75 / 1_000_000,
  cacheRead: 0.3 / 1_000_000,
};

function taxaUsdBrl(): number {
  const t = Number(process.env.USD_BRL);
  return Number.isFinite(t) && t > 0 ? t : 5.4;
}

/** Custo em USD para um uso de tokens. */
export function custoUsd(uso: UsoTokens): number {
  return (
    uso.inputTokens * USD_POR_TOKEN.input +
    uso.outputTokens * USD_POR_TOKEN.output +
    uso.cacheCreation * USD_POR_TOKEN.cacheCreation +
    uso.cacheRead * USD_POR_TOKEN.cacheRead
  );
}

/** Custo em centavos de BRL (arredondado) para um uso de tokens. */
export function custoBRLCents(uso: UsoTokens): number {
  return Math.round(custoUsd(uso) * taxaUsdBrl() * 100);
}
