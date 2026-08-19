import crypto from "node:crypto";

/**
 * Núcleo puro da ingestão de checkout (auto-contido: só depende de node:crypto,
 * para ser testável direto pelo runner). Cada plataforma (Ticto, Hotmart,
 * Kiwify) é um adapter que traduz o webhook cru para VendaCanonica. O resto do
 * sistema (ingestão, funil, ledger) não conhece nenhuma plataforma.
 *
 * ATENÇÃO: nomes de campo e valores dos adapters são o formato DOCUMENTADO de
 * cada plataforma. Precisam ser confirmados com um webhook real (compra de
 * teste) antes de ativar qualquer tenant. Até lá a ingestão fica dark.
 */

// ---------------------------------------------------------------- tipos
export type Plataforma = "hotmart" | "ticto" | "kiwify";

export type EventoVenda =
  | "compra_aprovada"
  | "pix_gerado"
  | "boleto_gerado"
  | "checkout_abandonado"
  | "reembolso"
  | "chargeback"
  | "assinatura_cancelada"
  | "outro";

export type Comprador = { nome: string; email: string; telefone: string };

export type VendaCanonica = {
  /** id da transação na plataforma (chave de idempotência). */
  externalId: string;
  evento: EventoVenda;
  /** status cru da plataforma, guardado para referência. */
  statusOriginal: string;
  produtoNome: string;
  oferta: string;
  valorCents: number;
  moeda: string;
  metodoPagamento: string;
  comprador: Comprador;
};

export type ResultadoParse =
  | { ok: true; venda: VendaCanonica }
  | { ok: false; motivo: string };

export type EntradaAssinatura = {
  rawBody: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  payload: unknown;
  secret: string;
};

export type Adapter = {
  plataforma: Plataforma;
  validarAssinatura(entrada: EntradaAssinatura): boolean;
  parse(payload: unknown): ResultadoParse;
};

/** Visão da integração de checkout para a UI de configuração (sem o segredo). */
export type IntegracaoCheckoutView = {
  plataforma: Plataforma;
  ativo: boolean;
  /** true se já há um segredo salvo (o valor em si nunca volta ao cliente). */
  temSecret: boolean;
  /** token que compõe a URL do webhook (?t=...); "" se ainda não configurada. */
  ingestToken: string;
  configurada: boolean;
};

// ---------------------------------------------------------- normalizadores
export const soDigitos = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

export const texto = (s: unknown): string =>
  typeof s === "string" ? s.trim() : s == null ? "" : String(s).trim();

export const emailNorm = (s: unknown): string => texto(s).toLowerCase();

/** Valor DECIMAL (reais) → centavos. Aceita number (12.5) ou string BR/US. */
export function reaisParaCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  const bruto = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!bruto) return 0;
  const normalizado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Valor que JÁ vem em centavos (inteiro) → centavos (não multiplica). */
export function centsDireto(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Meio de pagamento cru → pix|boleto|cartao|outro. */
export function metodoPagamento(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return "";
  if (s.includes("pix")) return "pix";
  if (s.includes("bole") || s.includes("billet") || s.includes("slip")) return "boleto";
  if (s.includes("card") || s.includes("cart") || s.includes("credit")) return "cartao";
  return "outro";
}

/** Comparação de strings em tempo constante (anti timing-attack). */
export function comparaSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** HMAC hex de um corpo cru com um segredo. */
export function hmacHex(algoritmo: "sha1" | "sha256", rawBody: string, secret: string): string {
  return crypto.createHmac(algoritmo, secret).update(rawBody, "utf8").digest("hex");
}

// --------------------------------------------------------------- Hotmart
const HOTMART_EVENTO: Record<string, EventoVenda> = {
  PURCHASE_APPROVED: "compra_aprovada",
  PURCHASE_COMPLETE: "compra_aprovada",
  PURCHASE_BILLET_PRINTED: "boleto_gerado",
  PURCHASE_OUT_OF_SHOPPING_CART: "checkout_abandonado",
  PURCHASE_REFUNDED: "reembolso",
  PURCHASE_PROTEST: "chargeback",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_CANCELED: "assinatura_cancelada",
  SUBSCRIPTION_CANCELLATION: "assinatura_cancelada",
};

function hotmartClassificar(eventoStr: string, status: string, metodo: string): EventoVenda {
  const direto = HOTMART_EVENTO[eventoStr];
  if (direto) return direto;
  if (status === "WAITING_PAYMENT" || status === "STARTED") {
    if (metodo.includes("PIX")) return "pix_gerado";
    if (metodo.includes("BILLET") || metodo.includes("BOLETO")) return "boleto_gerado";
  }
  return "outro";
}

export const hotmart: Adapter = {
  plataforma: "hotmart",
  validarAssinatura({ headers, payload, secret }) {
    if (!secret) return false;
    const doHeader = texto(headers["x-hotmart-hottok"]);
    const doBody = texto((payload as { hottok?: unknown } | null)?.hottok);
    return (
      (doHeader.length > 0 && comparaSeguro(doHeader, secret)) ||
      (doBody.length > 0 && comparaSeguro(doBody, secret))
    );
  },
  parse(payload) {
    const p = (payload ?? {}) as Record<string, any>;
    const data = (p.data ?? {}) as Record<string, any>;
    const purchase = (data.purchase ?? {}) as Record<string, any>;
    const eventoStr = texto(p.event || p.event_name).toUpperCase();
    const status = texto(purchase.status).toUpperCase();
    const metodo = texto(purchase.payment?.type || purchase.payment_type).toUpperCase();
    const externalId = texto(purchase.transaction || data.transaction || p.id);
    if (!externalId) return { ok: false, motivo: "sem transaction id" };
    const buyer = (data.buyer ?? {}) as Record<string, any>;
    const preco = (purchase.price ?? purchase.full_price ?? {}) as Record<string, any>;
    return {
      ok: true,
      venda: {
        externalId,
        evento: hotmartClassificar(eventoStr, status, metodo),
        statusOriginal: status || eventoStr,
        produtoNome: texto(data.product?.name),
        oferta: texto(purchase.offer?.code || data.subscription?.plan?.name),
        valorCents: reaisParaCents(preco.value),
        moeda: texto(preco.currency_value || preco.currency_code || "BRL") || "BRL",
        metodoPagamento: metodoPagamento(metodo),
        comprador: {
          nome: texto(buyer.name),
          email: emailNorm(buyer.email),
          telefone: soDigitos(buyer.checkout_phone || buyer.phone),
        },
      },
    };
  },
};

// ----------------------------------------------------------------- Ticto
const TICTO_STATUS: Record<string, EventoVenda> = {
  authorized: "compra_aprovada",
  approved: "compra_aprovada",
  paid: "compra_aprovada",
  refunded: "reembolso",
  chargeback: "chargeback",
  pix: "pix_gerado",
  pix_created: "pix_gerado",
  waiting_pix: "pix_gerado",
  waiting_payment: "pix_gerado",
  bank_slip: "boleto_gerado",
  billet: "boleto_gerado",
  waiting_billet: "boleto_gerado",
  abandoned_cart: "checkout_abandonado",
  canceled: "assinatura_cancelada",
  subscription_canceled: "assinatura_cancelada",
};

function tictoClassificar(status: string, metodo: string): EventoVenda {
  const direto = TICTO_STATUS[status];
  if (direto) {
    if (direto === "pix_gerado" && (metodo.includes("bole") || metodo.includes("billet"))) {
      return "boleto_gerado";
    }
    return direto;
  }
  return "outro";
}

export const ticto: Adapter = {
  plataforma: "ticto",
  validarAssinatura({ payload, secret }) {
    if (!secret) return false;
    const token = texto((payload as { token?: unknown } | null)?.token);
    return token.length > 0 && comparaSeguro(token, secret);
  },
  parse(payload) {
    const p = (payload ?? {}) as Record<string, any>;
    const status = texto(p.status || p.order?.status).toLowerCase();
    const metodo = texto(p.payment_method || p.order?.payment_method).toLowerCase();
    const externalId = texto(
      p.order?.transaction_hash || p.transaction?.hash || p.order?.hash || p.order_hash || p.id
    );
    if (!externalId) return { ok: false, motivo: "sem transaction hash" };
    const customer = (p.customer ?? {}) as Record<string, any>;
    const item = (p.item ?? (Array.isArray(p.items) ? p.items[0] : {}) ?? {}) as Record<string, any>;
    const valorBruto = p.order?.paid_amount ?? p.order?.amount ?? p.amount ?? item.amount;
    const valorCents =
      typeof valorBruto === "string" && valorBruto.includes(".")
        ? reaisParaCents(valorBruto)
        : centsDireto(valorBruto);
    return {
      ok: true,
      venda: {
        externalId,
        evento: tictoClassificar(status, metodo),
        statusOriginal: status,
        produtoNome: texto(item.product_name || item.name || p.product?.name),
        oferta: texto(item.offer_name || p.offer?.name),
        valorCents,
        moeda: "BRL",
        metodoPagamento: metodoPagamento(metodo),
        comprador: {
          nome: texto(customer.name),
          email: emailNorm(customer.email),
          telefone: soDigitos(customer.phone || customer.phone_number || customer.cellphone),
        },
      },
    };
  },
};

// ---------------------------------------------------------------- Kiwify
const KIWIFY_STATUS: Record<string, EventoVenda> = {
  paid: "compra_aprovada",
  approved: "compra_aprovada",
  refunded: "reembolso",
  chargedback: "chargeback",
  refused: "outro",
};

function kiwifyClassificar(status: string, tipoEvento: string, metodo: string): EventoVenda {
  if (tipoEvento.includes("abandoned")) return "checkout_abandonado";
  const direto = KIWIFY_STATUS[status];
  if (direto) return direto;
  if (status === "waiting_payment") {
    if (metodo.includes("bole")) return "boleto_gerado";
    return "pix_gerado";
  }
  return "outro";
}

export const kiwify: Adapter = {
  plataforma: "kiwify",
  validarAssinatura({ rawBody, query, secret }) {
    if (!secret) return false;
    const recebida = texto(query.signature).toLowerCase();
    if (!recebida) return false;
    const esperada = hmacHex("sha1", rawBody, secret).toLowerCase();
    return comparaSeguro(recebida, esperada);
  },
  parse(payload) {
    const p = (payload ?? {}) as Record<string, any>;
    const status = texto(p.order_status || p.status).toLowerCase();
    const tipoEvento = texto(p.webhook_event_type || p.event).toLowerCase();
    const metodo = texto(p.payment_method || p.Payment?.method).toLowerCase();
    const externalId = texto(p.order_id || p.id || p.order_ref);
    if (!externalId) return { ok: false, motivo: "sem order id" };
    const customer = (p.Customer ?? p.customer ?? {}) as Record<string, any>;
    const produto = (p.Product ?? p.product ?? {}) as Record<string, any>;
    const valorCents = centsDireto(
      p.Commissions?.charge_amount ?? p.charge_amount ?? p.Commissions?.product_base_price ?? p.amount
    );
    return {
      ok: true,
      venda: {
        externalId,
        evento: kiwifyClassificar(status, tipoEvento, metodo),
        statusOriginal: status || tipoEvento,
        produtoNome: texto(produto.product_name || produto.name),
        oferta: texto(p.subscription_plan?.name || produto.offer_name),
        valorCents,
        moeda: "BRL",
        metodoPagamento: metodoPagamento(metodo),
        comprador: {
          nome: texto(customer.full_name || customer.name || customer.first_name),
          email: emailNorm(customer.email),
          telefone: soDigitos(customer.mobile || customer.phone),
        },
      },
    };
  },
};

// --------------------------------------------------------------- registry
const ADAPTERS: Record<Plataforma, Adapter> = { hotmart, ticto, kiwify };

export const PLATAFORMAS = Object.keys(ADAPTERS) as Plataforma[];

/** Retorna o adapter da plataforma, ou null se desconhecida. */
export function getAdapter(plataforma: string): Adapter | null {
  return (ADAPTERS as Record<string, Adapter>)[plataforma] ?? null;
}
