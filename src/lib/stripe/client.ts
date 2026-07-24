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

export type CheckoutOpts = {
  tenantId: string;
  priceId: string;
  email?: string;
  customerId?: string | null;
  /** Taxa de implantação (centavos). Cobrada NA CONTRATAÇÃO como item avulso. */
  setupCents?: number;
  /** Carência em dias = trial real: a mensalidade só começa depois disso. */
  trialDays?: number;
  /** Nome do plano, só para rotular o item de implantação na fatura. */
  nomePlano?: string;
  successPath?: string;
  cancelPath?: string;
  /** Base URL (para teste); sem ela usa APP_PUBLIC_URL. */
  baseUrl?: string;
};

/**
 * Monta os params do Checkout (PURO, testável). Modela a oferta do dossiê (§7):
 * implantação como item AVULSO (vai na fatura inicial → cobrada no ato do
 * checkout) + mensalidade RECORRENTE com carência como trial real (só o
 * recorrente é adiado; a implantação não). Ver docs Stripe "one-time setup fee".
 */
export function montarParamsCheckout(opts: CheckoutOpts): Record<string, string> {
  const base = (opts.baseUrl ?? appUrl()).replace(/\/+$/, "");
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    success_url: `${base}${opts.successPath ?? "/configuracoes?assinatura=ok"}`,
    cancel_url: `${base}${opts.cancelPath ?? "/configuracoes?assinatura=cancel"}`,
    "metadata[tenant_id]": opts.tenantId,
    "subscription_data[metadata][tenant_id]": opts.tenantId,
    allow_promotion_codes: "true",
  };

  // Implantação (taxa única, na contratação): item avulso via price_data inline —
  // sem precisar de um Price pré-criado. Cobrado no checkout mesmo com trial.
  if (opts.setupCents && opts.setupCents > 0) {
    params["line_items[1][price_data][currency]"] = "brl";
    params["line_items[1][price_data][product_data][name]"] =
      `Implantação — Lolze ${opts.nomePlano ?? ""}`.trim();
    params["line_items[1][price_data][unit_amount]"] = String(Math.round(opts.setupCents));
    params["line_items[1][quantity]"] = "1";
  }

  // Carência = trial real: a mensalidade só arranca no go-live (dossiê §4.3/§7).
  if (opts.trialDays && opts.trialDays > 0) {
    params["subscription_data[trial_period_days]"] = String(Math.round(opts.trialDays));
  }

  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  return params;
}

/** Cria uma sessão de Checkout (assinatura + implantação + carência) e devolve a URL. */
export async function criarCheckout(opts: CheckoutOpts): Promise<string | null> {
  const r = await stripePost("/checkout/sessions", montarParamsCheckout(opts));
  return r.ok ? (r.json?.url ?? null) : null;
}

/** Cria um Produto + Preço recorrente mensal (BRL) no Stripe. Devolve o price id. */
export async function criarProdutoEPreco(opts: {
  nome: string;
  mensalCents: number;
}): Promise<string | null> {
  const prod = await stripePost("/products", { name: opts.nome });
  if (!prod.ok || !prod.json?.id) return null;
  const price = await stripePost("/prices", {
    product: String(prod.json.id),
    unit_amount: String(opts.mensalCents),
    currency: "brl",
    "recurring[interval]": "month",
  });
  return price.ok ? (price.json?.id ?? null) : null;
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
  // Tolerância de timestamp (anti-replay): assinatura válida porém antiga é rejeitada.
  const idadeS = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(Number(t)) || idadeS > 300) return null;
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
