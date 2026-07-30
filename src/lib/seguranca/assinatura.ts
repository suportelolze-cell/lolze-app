import crypto from "crypto";

/**
 * Validação da assinatura de webhooks da Meta (WhatsApp Cloud e Instagram).
 *
 * A Meta assina o corpo bruto com HMAC-SHA256 usando o App Secret e envia o
 * resultado no header `X-Hub-Signature-256: sha256=<hex>`. Comparamos em tempo
 * constante (timingSafeEqual) para não vazar informação por timing.
 *
 * Regra de segurança (dossiê): validar autenticação/assinatura em TODA entrada
 * externa. Sem o App Secret configurado, FALHA FECHADO em produção (rejeita) —
 * aceitar POST sem assinatura permitiria forjar leads e gastar a IA paga. Só em
 * dev/test (NODE_ENV != production) a validação fica desligada por conveniência.
 *
 * Extraído dos handlers para ter teste de regressão e uma única fonte da verdade
 * (os dois webhooks usam exatamente este esquema).
 */
export function assinaturaMetaValida(raw: string, header: string, appSecret: string): boolean {
  const secret = (appSecret || "").trim();
  // Sem segredo: libera só fora de produção; em produção rejeita (fail-closed).
  if (!secret) return process.env.NODE_ENV !== "production";

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
