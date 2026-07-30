import { test } from "node:test";
import assert from "node:assert/strict";
import { statusAssinaturaStripe } from "../src/lib/stripe/client.ts";

test("active e trialing → ativo (únicos que liberam o app)", () => {
  assert.equal(statusAssinaturaStripe("active"), "ativo");
  assert.equal(statusAssinaturaStripe("trialing"), "ativo");
});

test("past_due e unpaid → inadimplente", () => {
  assert.equal(statusAssinaturaStripe("past_due"), "inadimplente");
  assert.equal(statusAssinaturaStripe("unpaid"), "inadimplente");
});

test("canceled → cancelado", () => {
  assert.equal(statusAssinaturaStripe("canceled"), "cancelado");
});

test("FAIL-CLOSED: incomplete/incomplete_expired/paused NUNCA viram ativo", () => {
  // Estes eram o bug: caíam no default `?? "ativo"`.
  assert.notEqual(statusAssinaturaStripe("incomplete"), "ativo");
  assert.notEqual(statusAssinaturaStripe("incomplete_expired"), "ativo");
  assert.notEqual(statusAssinaturaStripe("paused"), "ativo");
  assert.equal(statusAssinaturaStripe("incomplete"), "inadimplente");
  assert.equal(statusAssinaturaStripe("incomplete_expired"), "cancelado");
  assert.equal(statusAssinaturaStripe("paused"), "suspenso");
});

test("FAIL-CLOSED: status desconhecido/nulo → inadimplente (não libera)", () => {
  assert.equal(statusAssinaturaStripe("status_novo_do_stripe"), "inadimplente");
  assert.equal(statusAssinaturaStripe(null), "inadimplente");
  assert.equal(statusAssinaturaStripe(undefined), "inadimplente");
  assert.equal(statusAssinaturaStripe(""), "inadimplente");
});

test("nenhum status do Stripe libera 'ativo' por engano, exceto active/trialing", () => {
  const todos = [
    "past_due", "unpaid", "incomplete", "incomplete_expired",
    "paused", "canceled", "qualquer_coisa",
  ];
  for (const s of todos) assert.notEqual(statusAssinaturaStripe(s), "ativo");
});
