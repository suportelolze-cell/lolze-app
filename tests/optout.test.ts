import { test } from "node:test";
import assert from "node:assert/strict";

import { ehPedidoParada } from "../src/lib/agent/optout.ts";

test("pega pedidos de parada óbvios", () => {
  for (const t of [
    "PARE",
    "pare",
    "Parar",
    "sair",
    "STOP",
    "descadastrar",
    "Pare de me mandar mensagem",
    "para de me mandar msg",
    "não quero mais receber",
    "nao quero receber mensagens",
    "me tira da lista",
    "quero cancelar inscrição",
  ]) {
    assert.equal(ehPedidoParada(t), true, `deveria ser parada: "${t}"`);
  }
});

test("normaliza acento (não quero mais receber)", () => {
  assert.equal(ehPedidoParada("Não quero mais receber."), true);
});

test("NÃO confunde mensagem normal com parada (sem falso positivo)", () => {
  for (const t of [
    "quanto custa?",
    "parei de fumar mês passado",
    "vou sair mais tarde, me chama depois",
    "não pare de me atender por favor",
    "quero saber o preço",
    "reparei que você respondeu rápido",
    "pode cancelar meu horário de amanhã?",
    "",
  ]) {
    assert.equal(ehPedidoParada(t), false, `NÃO deveria ser parada: "${t}"`);
  }
});
