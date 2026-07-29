import { test } from "node:test";
import assert from "node:assert/strict";
import { conteudoMensagem } from "../src/lib/agent/sdr/historico-core.ts";

test("conteudoMensagem preserva texto real", () => {
  assert.equal(conteudoMensagem("Oi, tudo bem?"), "Oi, tudo bem?");
});

test("conteudoMensagem troca vazio/whitespace/null por marcador (nunca content vazio)", () => {
  const marcador = "[arquivo/mídia enviado]";
  assert.equal(conteudoMensagem(""), marcador);
  assert.equal(conteudoMensagem("   "), marcador);
  assert.equal(conteudoMensagem(null), marcador);
  assert.equal(conteudoMensagem(undefined), marcador);
});
