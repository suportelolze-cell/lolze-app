import { test } from "node:test";
import assert from "node:assert/strict";
import { soDigitosBR, ehOperador } from "../src/lib/whatsapp/numero-core.ts";

test("soDigitosBR: normaliza com DDI 55", () => {
  assert.equal(soDigitosBR("11987654321"), "5511987654321");
  assert.equal(soDigitosBR("(11) 98765-4321"), "5511987654321");
  assert.equal(soDigitosBR("5511987654321"), "5511987654321");
});

test("soDigitosBR: curto/longo demais -> ''", () => {
  assert.equal(soDigitosBR("123"), "");
  assert.equal(soDigitosBR(""), "");
  assert.equal(soDigitosBR("012345678901234"), "");
});

test("ehOperador: recebido (com DDI) casa a config com ou sem DDI/formatação", () => {
  // WhatsApp entrega o 'de' sempre com DDI.
  assert.equal(ehOperador("5511987654321", "(11) 98765-4321"), true);
  assert.equal(ehOperador("5511987654321", "5511987654321"), true);
});

test("ehOperador: números diferentes -> false", () => {
  assert.equal(ehOperador("5511987654321", "5511911112222"), false);
});

test("ehOperador: config vazia/inválida NUNCA casa (allowlist no-op)", () => {
  assert.equal(ehOperador("5511987654321", ""), false);
  assert.equal(ehOperador("5511987654321", "123"), false);
  assert.equal(ehOperador("", "5511987654321"), false);
});

test("ehOperador: NÃO prefixa o recebido — estrangeiro não colide com operador BR", () => {
  // Lead estrangeiro cujos dígitos nacionais batem com DDD+número do operador:
  // como não prefixamos '55' no recebido, NÃO casa (não perde a mensagem).
  assert.equal(ehOperador("11987654321", "5511987654321"), false);
});
