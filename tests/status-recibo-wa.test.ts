import { test } from "node:test";
import assert from "node:assert/strict";
import { promoverPorRecibo, statusDoRecibo } from "../src/lib/whatsapp/status-recibo.ts";

test("mapeia o tipo do recibo para o status interno", () => {
  assert.equal(statusDoRecibo("sent"), "enviada");
  assert.equal(statusDoRecibo("delivered"), "entregue");
  assert.equal(statusDoRecibo("read"), "lida");
  assert.equal(statusDoRecibo("qualquer"), null);
});

test("progressão normal avança o status", () => {
  assert.equal(promoverPorRecibo("pendente", "sent"), "enviada");
  assert.equal(promoverPorRecibo("enviada", "delivered"), "entregue");
  assert.equal(promoverPorRecibo("entregue", "read"), "lida");
  // pode saltar etapas (delivered direto sobre pendente)
  assert.equal(promoverPorRecibo("pendente", "read"), "lida");
});

test("recibo FORA DE ORDEM nunca rebaixa o status", () => {
  // já foi lida → um 'sent'/'delivered' atrasado é ignorado
  assert.equal(promoverPorRecibo("lida", "sent"), null);
  assert.equal(promoverPorRecibo("lida", "delivered"), null);
  // já entregue → 'sent' atrasado ignorado
  assert.equal(promoverPorRecibo("entregue", "sent"), null);
});

test("recibo repetido no mesmo estado é ignorado (não regrava)", () => {
  assert.equal(promoverPorRecibo("enviada", "sent"), null);
  assert.equal(promoverPorRecibo("entregue", "delivered"), null);
  assert.equal(promoverPorRecibo("lida", "read"), null);
});

test("status 'falhou' não é promovido por recibo de progresso", () => {
  // 'falhou' não está em nenhuma lista de anteriores → nunca vira enviada/entregue/lida
  assert.equal(promoverPorRecibo("falhou", "sent"), null);
  assert.equal(promoverPorRecibo("falhou", "delivered"), null);
  assert.equal(promoverPorRecibo("falhou", "read"), null);
});

test("tipo de recibo desconhecido é ignorado", () => {
  assert.equal(promoverPorRecibo("enviada", "clicked"), null);
  assert.equal(promoverPorRecibo("pendente", ""), null);
});
