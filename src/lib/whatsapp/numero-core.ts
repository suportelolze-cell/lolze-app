/**
 * Comparação de números de WhatsApp — núcleo PURO (sem `@/`), testável.
 * Usado pelo allowlist de OPERADOR: mensagem vinda do próprio número do
 * operador/prestador do tenant NÃO deve virar lead nem acionar o SDR.
 */

/** Normaliza um número BR para dígitos com DDI 55. "" se implausível. */
export function soDigitosBR(s: string): string {
  const d = (s || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  const comDDI = d.length <= 11 ? "55" + d : d;
  // Válido = 55 + DDD(2) + 8/9 = 12 ou 13 dígitos. Rejeita blobs longos.
  return comDDI.length > 13 ? "" : comDDI;
}

/**
 * O número RECEBIDO (o WhatsApp entrega sempre com DDI, ex.: 5511987654321) é o
 * operador (especialista_numero configurado)? Comparação DIRECIONAL: normaliza só
 * a CONFIG (adiciona 55 se faltar) e compara com os dígitos do recebido SEM
 * prefixar — assim um número estrangeiro de 11 dígitos nunca ganha um "55" falso
 * e é bloqueado por engano (perda de mensagem de cliente). Config vazia/inválida
 * NUNCA casa (allowlist vira no-op). Se os formatos divergirem (ex.: 9º dígito),
 * a direção segura é NÃO casar (o operador vira lead) — nunca perder cliente.
 */
export function ehOperador(deRecebido: string, especialistaConfig: string): boolean {
  const config = soDigitosBR(especialistaConfig);
  if (!config) return false;
  const de = (deRecebido || "").replace(/\D/g, "");
  return de !== "" && de === config;
}
