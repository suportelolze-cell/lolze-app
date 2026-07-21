import crypto from "crypto";

/**
 * Validação da assinatura de webhooks da Meta (WhatsApp Cloud e Instagram).
 *
 * A Meta assina o corpo bruto com HMAC-SHA256 usando o App Secret e envia o
 * resultado no header `X-Hub-Signature-256: sha256=<hex>`. Comparamos em tempo
 * constante (timingSafeEqual) para não vazar informação por timing.
 *
 * Regra de segurança (dossiê): validar autenticação/assinatura em TODA entrada
 * externa. Quando o App Secret não está configurado, a validação fica desligada
 * (retorna true) — é o comportamento atual, mantido para não quebrar ambientes
 * ainda sem o segredo; em produção o segredo deve estar sempre presente.
 *
 * Extraído dos handlers para ter teste de regressão e uma única fonte da verdade
 * (os dois webhooks usam exatamente este esquema).
 */
export function assinaturaMetaValida(raw: string, header: string, appSecret: string): boolean {
  const secret = (appSecret || "").trim();
  if (!secret) return true; // validação desligada quando não há segredo

  const recebida = header || "";
  const esperada = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return (
      recebida.length === esperada.length &&
      crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada))
    );
  } catch {
    return false;
  }
}
