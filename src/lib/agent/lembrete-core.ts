/**
 * Núcleo PURO dos lembretes (sem `@/`, testável). Formatação da mensagem ao
 * PRESTADOR (aviso do agendamento) e normalização do número dele.
 */

/** Normaliza um número BR para dígitos com DDI 55. "" se implausível. */
export function normalizarNumeroBR(s: string): string {
  const d = (s || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  const comDDI = d.length <= 11 ? "55" + d : d;
  // Válido = 55 + DDD(2) + 8/9 = 12 ou 13 dígitos. Rejeita blobs longos.
  return comDDI.length > 13 ? "" : comDDI;
}

/**
 * Mensagem de heads-up para o prestador sobre um agendamento próximo. `quando`
 * já vem formatado (dd/mm HH:MM) pelo chamador (fuso America/Sao_Paulo).
 */
export function mensagemPrestador(
  nome: string | null,
  servico: string | null,
  quando: string
): string {
  const cliente = (nome || "").trim() || "um cliente";
  const svc = (servico || "").trim() || "atendimento";
  return `📅 Lembrete Lolze: você tem ${svc} com ${cliente} em ${quando}. (Já enviei a confirmação automática pra ele(a).)`;
}
