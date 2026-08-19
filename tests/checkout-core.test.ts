import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  reaisParaCents,
  centsDireto,
  metodoPagamento,
  comparaSeguro,
  hmacHex,
  getAdapter,
  PLATAFORMAS,
  hotmart,
  ticto,
  kiwify,
} from "../src/lib/checkout/core.ts";

// ---------- normalizadores ----------
test("reaisParaCents aceita number, decimal e formato BR", () => {
  assert.equal(reaisParaCents(12.5), 1250);
  assert.equal(reaisParaCents("1234.56"), 123456);
  assert.equal(reaisParaCents("1.234,56"), 123456);
  assert.equal(reaisParaCents("R$ 99,90"), 9990);
  assert.equal(reaisParaCents(""), 0);
});

test("centsDireto não multiplica (valor já em centavos)", () => {
  assert.equal(centsDireto(9990), 9990);
  assert.equal(centsDireto("9990"), 9990);
  assert.equal(centsDireto(undefined), 0);
});

test("metodoPagamento normaliza para pix|boleto|cartao|outro", () => {
  assert.equal(metodoPagamento("PIX"), "pix");
  assert.equal(metodoPagamento("credit_card"), "cartao");
  assert.equal(metodoPagamento("BILLET"), "boleto");
  assert.equal(metodoPagamento(""), "");
});

test("comparaSeguro é true só para strings iguais", () => {
  assert.equal(comparaSeguro("abc", "abc"), true);
  assert.equal(comparaSeguro("abc", "abd"), false);
  assert.equal(comparaSeguro("abc", "abcd"), false);
});

// ---------- registry ----------
test("getAdapter resolve as três plataformas e nada além", () => {
  assert.deepEqual([...PLATAFORMAS].sort(), ["hotmart", "kiwify", "ticto"]);
  assert.equal(getAdapter("hotmart")?.plataforma, "hotmart");
  assert.equal(getAdapter("ticto")?.plataforma, "ticto");
  assert.equal(getAdapter("kiwify")?.plataforma, "kiwify");
  assert.equal(getAdapter("stripe"), null);
});

// ---------- Hotmart ----------
const hotmartAprovado = {
  event: "PURCHASE_APPROVED",
  data: {
    product: { name: "Curso X" },
    buyer: { name: "Ana", email: "ANA@Mail.com", checkout_phone: "(11) 99999-0000" },
    purchase: {
      transaction: "HP123",
      status: "APPROVED",
      payment: { type: "CREDIT_CARD" },
      price: { value: 197.0, currency_value: "BRL" },
      offer: { code: "of1" },
    },
  },
};

test("Hotmart: compra aprovada normaliza evento, valor e comprador", () => {
  const r = hotmart.parse(hotmartAprovado);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.venda.evento, "compra_aprovada");
  assert.equal(r.venda.externalId, "HP123");
  assert.equal(r.venda.valorCents, 19700);
  assert.equal(r.venda.metodoPagamento, "cartao");
  assert.equal(r.venda.comprador.email, "ana@mail.com");
  assert.equal(r.venda.comprador.telefone, "11999990000");
  assert.equal(r.venda.produtoNome, "Curso X");
});

test("Hotmart: PIX aguardando pagamento vira pix_gerado", () => {
  const r = hotmart.parse({
    event: "PURCHASE_WAITING",
    data: { purchase: { transaction: "HP9", status: "WAITING_PAYMENT", payment: { type: "PIX" } } },
  });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.venda.evento, "pix_gerado");
});

test("Hotmart: reembolso e sem-id", () => {
  const r = hotmart.parse({ event: "PURCHASE_REFUNDED", data: { purchase: { transaction: "HP1", status: "REFUNDED" } } });
  assert.ok(r.ok && r.venda.evento === "reembolso");
  assert.equal(hotmart.parse({ event: "PURCHASE_APPROVED", data: {} }).ok, false);
});

test("Hotmart: hottok valida por header ou corpo, e rejeita errado", () => {
  const base = { rawBody: "", query: {}, payload: { hottok: "seg-body" }, secret: "seg-body" };
  assert.equal(hotmart.validarAssinatura({ ...base, headers: {} }), true);
  assert.equal(
    hotmart.validarAssinatura({ rawBody: "", query: {}, payload: {}, headers: { "x-hotmart-hottok": "seg-h" }, secret: "seg-h" }),
    true
  );
  assert.equal(hotmart.validarAssinatura({ ...base, headers: {}, secret: "outro" }), false);
  assert.equal(hotmart.validarAssinatura({ ...base, headers: {}, secret: "" }), false);
});

// ---------- Ticto ----------
test("Ticto: status authorized vira compra_aprovada; token valida", () => {
  const payload = {
    token: "tk-ticto",
    status: "authorized",
    payment_method: "credit_card",
    order: { transaction_hash: "TC1", paid_amount: 9990 },
    item: { product_name: "Mentoria" },
    customer: { name: "Beto", email: "b@x.com", phone: "11888887777" },
  };
  const r = ticto.parse(payload);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.venda.evento, "compra_aprovada");
    assert.equal(r.venda.externalId, "TC1");
    assert.equal(r.venda.valorCents, 9990); // já em centavos
    assert.equal(r.venda.produtoNome, "Mentoria");
  }
  assert.equal(ticto.validarAssinatura({ rawBody: "", query: {}, headers: {}, payload, secret: "tk-ticto" }), true);
  assert.equal(ticto.validarAssinatura({ rawBody: "", query: {}, headers: {}, payload, secret: "errado" }), false);
});

test("Ticto: waiting_payment com boleto vira boleto_gerado", () => {
  const r = ticto.parse({ status: "waiting_payment", payment_method: "boleto", order: { transaction_hash: "TC2" } });
  assert.ok(r.ok && r.venda.evento === "boleto_gerado");
});

// ---------- Kiwify ----------
test("Kiwify: paid vira compra_aprovada e valor fica em centavos", () => {
  const r = kiwify.parse({
    order_id: "KW1",
    order_status: "paid",
    payment_method: "pix",
    Customer: { full_name: "Cida", email: "c@y.com", mobile: "11777776666" },
    Product: { product_name: "Ebook" },
    Commissions: { charge_amount: 4700 },
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.venda.evento, "compra_aprovada");
    assert.equal(r.venda.valorCents, 4700);
    assert.equal(r.venda.metodoPagamento, "pix");
    assert.equal(r.venda.comprador.email, "c@y.com");
  }
});

test("Kiwify: assinatura HMAC-SHA1 do corpo cru valida e rejeita adulteração", () => {
  const secret = "kw-secret";
  const rawBody = JSON.stringify({ order_id: "KW2", order_status: "paid" });
  const assinatura = hmacHex("sha1", rawBody, secret);
  const base = { headers: {}, payload: JSON.parse(rawBody), secret };
  assert.equal(kiwify.validarAssinatura({ ...base, rawBody, query: { signature: assinatura } }), true);
  assert.equal(kiwify.validarAssinatura({ ...base, rawBody: rawBody + " ", query: { signature: assinatura } }), false);
  assert.equal(kiwify.validarAssinatura({ ...base, rawBody, query: { signature: "deadbeef" } }), false);
  assert.equal(kiwify.validarAssinatura({ ...base, rawBody, query: {} }), false);
});

test("Kiwify: sanity do hmac com implementação de referência", () => {
  const esperado = crypto.createHmac("sha1", "s").update("abc", "utf8").digest("hex");
  assert.equal(hmacHex("sha1", "abc", "s"), esperado);
});
