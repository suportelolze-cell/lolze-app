import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { assinaturaMetaValida } from "../src/lib/seguranca/assinatura.ts";

const SECRET = "app-secret-de-teste";
const corpo = JSON.stringify({ entry: [{ id: "123", changes: [] }] });

function assinar(raw: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

test("aceita assinatura correta", () => {
  assert.equal(assinaturaMetaValida(corpo, assinar(corpo, SECRET), SECRET), true);
});

test("rejeita assinatura de segredo errado", () => {
  assert.equal(assinaturaMetaValida(corpo, assinar(corpo, "outro-segredo"), SECRET), false);
});

test("rejeita quando o corpo foi adulterado após assinar", () => {
  const sig = assinar(corpo, SECRET);
  const adulterado = corpo + " ";
  assert.equal(assinaturaMetaValida(adulterado, sig, SECRET), false);
});

test("rejeita header vazio ou malformado", () => {
  assert.equal(assinaturaMetaValida(corpo, "", SECRET), false);
  assert.equal(assinaturaMetaValida(corpo, "sha256=", SECRET), false);
  assert.equal(assinaturaMetaValida(corpo, "lixo", SECRET), false);
});

test("sem App Secret configurado → validação desligada (aceita)", () => {
  // Comportamento atual mantido: sem segredo, não bloqueia (compat).
  assert.equal(assinaturaMetaValida(corpo, "", ""), true);
  assert.equal(assinaturaMetaValida(corpo, "qualquer", "  "), true);
});

test("comparação é resiliente a tamanhos diferentes (não lança)", () => {
  // timingSafeEqual lança se os buffers têm tamanhos diferentes; o helper
  // pré-checa o comprimento e captura, então nunca propaga exceção.
  assert.doesNotThrow(() => assinaturaMetaValida(corpo, "sha256=abc", SECRET));
  assert.equal(assinaturaMetaValida(corpo, "sha256=abc", SECRET), false);
});
