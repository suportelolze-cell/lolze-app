import { test } from "node:test";
import assert from "node:assert/strict";

// A chave é derivada do ambiente; fixa aqui antes de importar o módulo.
process.env.APP_CRYPTO_KEY = "chave-de-teste-bem-longa-para-derivar-32b";

import { cifrar, decifrar, estaCifrado } from "../src/lib/checkout/cripto.ts";

test("round-trip: decifrar(cifrar(x)) === x", () => {
  const segredo = "hottok_ABC123-super-secreto";
  const cifrado = cifrar(segredo);
  assert.ok(estaCifrado(cifrado), "deve ter o prefixo de cifra");
  assert.notEqual(cifrado, segredo, "não pode ficar em texto puro");
  assert.equal(decifrar(cifrado), segredo);
});

test("cifra é não-determinística (IV aleatório)", () => {
  const a = cifrar("mesmo-segredo");
  const b = cifrar("mesmo-segredo");
  assert.notEqual(a, b, "dois cifrados do mesmo texto devem diferir");
  assert.equal(decifrar(a), decifrar(b));
});

test("legado em texto puro passa direto", () => {
  assert.equal(estaCifrado("token_em_texto_puro"), false);
  assert.equal(decifrar("token_em_texto_puro"), "token_em_texto_puro");
});

test("vazio/nulo viram string vazia ao decifrar", () => {
  assert.equal(decifrar(null), "");
  assert.equal(decifrar(undefined), "");
  assert.equal(decifrar(""), "");
});

test("adulteração do texto cifrado falha (retorna vazio, não o segredo)", () => {
  const cifrado = cifrar("segredo-intacto");
  // troca o último caractere base64 (corpo/tag) → GCM deve reprovar
  const adulterado = cifrado.slice(0, -2) + (cifrado.endsWith("A") ? "B" : "A") + "=";
  assert.equal(decifrar(adulterado), "");
});
