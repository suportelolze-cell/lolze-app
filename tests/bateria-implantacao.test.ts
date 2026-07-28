import { test } from "node:test";
import assert from "node:assert/strict";
import { BATERIA_PADRAO } from "../src/lib/agent/sdr/bateria.ts";

test("bateria tem cenários suficientes para cobrir os arquétipos de micro", () => {
  assert.ok(BATERIA_PADRAO.length >= 10, "esperado ao menos 10 casos");
});

test("todo caso tem chave, rótulo e pergunta não-vazios", () => {
  for (const c of BATERIA_PADRAO) {
    assert.ok(c.chave && c.chave.trim().length > 0, `chave vazia em ${JSON.stringify(c)}`);
    assert.ok(c.rotulo && c.rotulo.trim().length > 0, `rótulo vazio em ${c.chave}`);
    assert.ok(c.pergunta && c.pergunta.trim().length > 0, `pergunta vazia em ${c.chave}`);
  }
});

test("as chaves são únicas (o card usa como identificador)", () => {
  const chaves = BATERIA_PADRAO.map((c) => c.chave);
  assert.equal(new Set(chaves).size, chaves.length, "há chaves duplicadas");
});

test("cobre os 3 arquétipos de micro + casos típicos de WhatsApp", () => {
  const chaves = new Set(BATERIA_PADRAO.map((c) => c.chave));
  // serviço com agenda, venda de produto, orçamento
  for (const k of ["agenda", "produto", "orcamento"]) {
    assert.ok(chaves.has(k), `faltou o arquétipo: ${k}`);
  }
  // casos típicos: pedir humano (handoff), áudio, fora de escopo
  for (const k of ["humano", "audio", "fora_escopo"]) {
    assert.ok(chaves.has(k), `faltou o caso típico: ${k}`);
  }
});
