import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarBibliotecaParaPrompt } from "../src/lib/biblioteca/biblioteca-core.ts";

test("biblioteca vazia não gera bloco no prompt", () => {
  assert.equal(formatarBibliotecaParaPrompt([]), "");
});

test("formata os arquivos com id/nome/quando-usar", () => {
  const out = formatarBibliotecaParaPrompt([
    { id: "abc", nome: "Tabela de preços", quandoUsar: "quando perguntarem valor" },
    { id: "def", nome: "Foto da loja", quandoUsar: "" },
  ]);
  assert.match(out, /enviar_arquivo/);
  assert.match(out, /id=abc — Tabela de preços — enviar quando: quando perguntarem valor/);
  assert.match(out, /id=def — Foto da loja/);
  // sem "enviar quando" quando o rótulo está vazio
  assert.ok(!/id=def.*enviar quando/.test(out));
});
