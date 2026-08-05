import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarNumeroBR, mensagemPrestador } from "../src/lib/agent/lembrete-core.ts";

test("normalizarNumeroBR: adiciona DDI 55 quando falta", () => {
  assert.equal(normalizarNumeroBR("11987654321"), "5511987654321");
  assert.equal(normalizarNumeroBR("(11) 98765-4321"), "5511987654321");
  assert.equal(normalizarNumeroBR("5511987654321"), "5511987654321");
});

test("normalizarNumeroBR: rejeita curto demais e longo demais", () => {
  assert.equal(normalizarNumeroBR("123"), "");
  assert.equal(normalizarNumeroBR(""), "");
  assert.equal(normalizarNumeroBR("012345678901234"), ""); // >13 dígitos
});

test("mensagemPrestador: usa cliente e serviço", () => {
  const m = mensagemPrestador("Maria Silva", "Corte", "05/08 14:30");
  assert.match(m, /Corte/);
  assert.match(m, /Maria Silva/);
  assert.match(m, /05\/08 14:30/);
});

test("mensagemPrestador: fallback quando faltam nome/serviço", () => {
  const m = mensagemPrestador(null, "", "05/08 09:00");
  assert.match(m, /um cliente/);
  assert.match(m, /atendimento/);
});
