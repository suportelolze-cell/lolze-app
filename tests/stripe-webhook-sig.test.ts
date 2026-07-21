import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// verificarWebhook lê STRIPE_WEBHOOK_SECRET em tempo de CHAMADA — basta setar antes.
const SECRET = "whsec_teste_regressao";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const { verificarWebhook } = await import("../src/lib/stripe/client.ts");

const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });

function assinar(body: string, secret: string, t?: number): string {
  const ts = t ?? Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

test("assinatura válida e recente → devolve o evento parseado", () => {
  const ev = verificarWebhook(payload, assinar(payload, SECRET));
  assert.ok(ev);
  assert.equal(ev.id, "evt_1");
  assert.equal(ev.type, "checkout.session.completed");
});

test("segredo errado → null", () => {
  assert.equal(verificarWebhook(payload, assinar(payload, "outro_segredo")), null);
});

test("payload adulterado depois de assinar → null", () => {
  const sig = assinar(payload, SECRET);
  const adulterado = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });
  assert.equal(verificarWebhook(adulterado, sig), null);
});

test("timestamp fora da tolerância (>300s) → null (anti-replay)", () => {
  const antigo = Math.floor(Date.now() / 1000) - 400;
  assert.equal(verificarWebhook(payload, assinar(payload, SECRET, antigo)), null);
});

test("header malformado ou incompleto → null", () => {
  assert.equal(verificarWebhook(payload, ""), null);
  assert.equal(verificarWebhook(payload, null), null);
  assert.equal(verificarWebhook(payload, "lixo"), null);
  const ts = Math.floor(Date.now() / 1000);
  assert.equal(verificarWebhook(payload, `t=${ts}`), null); // sem v1
  const v1 = crypto.createHmac("sha256", SECRET).update(`${ts}.${payload}`).digest("hex");
  assert.equal(verificarWebhook(payload, `v1=${v1}`), null); // sem t
});

test("assinatura válida mas corpo não-JSON → null", () => {
  const naoJson = "isto nao e json";
  assert.equal(verificarWebhook(naoJson, assinar(naoJson, SECRET)), null);
});

test("sem STRIPE_WEBHOOK_SECRET configurado → null (não valida às cegas)", () => {
  const salvo = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    assert.equal(verificarWebhook(payload, assinar(payload, SECRET)), null);
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = salvo;
  }
});
