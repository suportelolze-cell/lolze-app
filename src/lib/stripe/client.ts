import crypto from "crypto";

/**
 * Cliente do Stripe via API REST (sem SDK) — SERVER-ONLY.
 * Usa STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET (env, nunca no browser).
 * Um Stripe atende todos os clientes; cada tenant guarda customer/subscription.
 */
const API = "https://api.stripe.com/v1";

export function temStripe() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function appUrl() {
  return (process.env.APP_PUBLIC_URL || "https://www.app.lolze.com.br").replace(/\/+$/, "");
}

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ""}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, json };
}

/** Cria uma sessão de Checkout (assinatura) e devolve a URL de pagamento. */
export async function criarCheckout(opts: {
  tenantId: string;
  priceId: string;
  email?: string;
  customerId?: string | null;
}): Promise<string | null> {
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl()}/configuracoes?assinatura=ok`,
    cancel_url: `${appUrl()}/configuracoes?assinatura=cancel`,
    "metadata[tenant_id]": opts.tenantId,
    "subscription_data[metadata][tenant_id]": opts.tenantId,
    allow_promotion_codes: "true",
  };
  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  const r = await stripePost("/checkout/sessions", params);
  return r.ok ? (r.json?.url ?? null) : null;
}

/** Cria uma sessão do Portal do Cliente (gerenciar/cancelar assinatura). */
export async function criarPortal(customerId: string): Promise<string | null> {
  const r = await stripePost("/billing_portal/sessions", {
    customer: customerId,
    return_url: `${appUrl()}/configuracoes`,
  });
  return r.ok ? (r.json?.url ?? null) : null;
}

/** Verifica a assinatura do webhook do Stripe e devolve o evento, ou null. */
export function verificarWebhook(payload: string, sig: string | null): any | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret || !sig) return null;
  const partes = Object.fromEntries(
    sig.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const t = partes["t"];
  const v1 = partes["v1"];
  if (!t || !v1) return null;
  const esperado = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    if (
      esperado.length !== v1.length ||
      !crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
