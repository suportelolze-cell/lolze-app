import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_REENVIOS, backoffMin, esgotou } from "../src/lib/integracoes/reenvio.ts";

test("backoff é crescente e satura no último degrau", () => {
  assert.equal(backoffMin(0), 15);
  assert.equal(backoffMin(1), 30);
  assert.equal(backoffMin(2), 60);
  assert.equal(backoffMin(3), 120);
  // além da tabela, satura (não cresce infinito nem quebra)
  assert.equal(backoffMin(10), 120);
});

test("backoff nunca é negativo, mesmo com entrada estranha", () => {
  assert.equal(backoffMin(-5), 15);
});

test("esgotou vira verdadeiro exatamente ao atingir MAX_REENVIOS", () => {
  for (let i = 0; i < MAX_REENVIOS; i++) assert.equal(esgotou(i), false);
  assert.equal(esgotou(MAX_REENVIOS), true);
  assert.equal(esgotou(MAX_REENVIOS + 3), true);
});

test("a régua de reenvio é finita (converge para dead-letter)", () => {
  // Simula o loop do cron: incrementa até esgotar. Deve terminar.
  let feitos = 0;
  let ciclos = 0;
  while (!esgotou(feitos) && ciclos < 100) {
    feitos += 1; // cada ciclo do cron faz +1 reenvio
    ciclos += 1;
  }
  assert.equal(esgotou(feitos), true);
  assert.equal(feitos, MAX_REENVIOS); // termina em exatamente MAX, sem loop infinito
});
