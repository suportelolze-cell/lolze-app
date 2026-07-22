import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avancar,
  primeiroFollowup,
  agendarReativacao,
  CADENCIA_MIN,
  REATIVACAO_MIN,
} from "../src/lib/agent/followup-cadencia.ts";

test("primeiroFollowup começa a cadência no 1º gap", () => {
  const f = primeiroFollowup();
  assert.equal(f.modo, "cadencia");
  assert.equal(f.count, 0);
  assert.ok(f.proximo); // agendado
});

test("agendarReativacao começa a reativação (mínimo 1 dia)", () => {
  const r = agendarReativacao(10);
  assert.equal(r.modo, "reativacao");
  assert.equal(r.count, 0);
  assert.ok(r.proximo);
  // dias < 1 é normalizado para 1 (não agenda no passado)
  assert.ok(agendarReativacao(0).proximo);
});

test("cadência avança toque a toque até o fim dos 4", () => {
  // count 0→1, 1→2, 2→3 seguem na cadência
  for (let c = 0; c < CADENCIA_MIN.length - 1; c++) {
    const p = avancar("cadencia", c);
    assert.equal(p.modo, "cadencia");
    assert.equal(p.count, c + 1);
    assert.ok(p.proximo);
  }
});

test("último toque da cadência transiciona para reativação", () => {
  const p = avancar("cadencia", CADENCIA_MIN.length - 1); // count 3 → novo 4
  assert.equal(p.modo, "reativacao");
  assert.equal(p.count, 0);
  assert.ok(p.proximo);
});

test("reativação avança e depois ENCERRA a régua (não fica em loop)", () => {
  assert.equal(avancar("reativacao", 0).modo, "reativacao");
  assert.equal(avancar("reativacao", 1).modo, "reativacao");
  // último passo da reativação → fim: proximo null, modo null
  const fim = avancar("reativacao", REATIVACAO_MIN.length - 1);
  assert.equal(fim.proximo, null);
  assert.equal(fim.modo, null);
});

test("modo desconhecido/null encerra a régua (fail-safe)", () => {
  assert.deepEqual(
    { proximo: avancar(null, 0).proximo, modo: avancar(null, 0).modo },
    { proximo: null, modo: null }
  );
  assert.equal(avancar("qualquer", 5).proximo, null);
});
