import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate,
  validarMensagemDisparo,
  erroDeColunaAusente,
} from "../src/lib/captacao/captacao-core.ts";

const P = { nome_empresa: "Padaria do Zé", cidade: "Recife", nicho: "alimentação" };

test("renderTemplate: substitui nome/empresa/cidade/nicho", () => {
  assert.equal(
    renderTemplate("Oi {nome}, tudo bem em {cidade}?", P),
    "Oi Padaria do Zé, tudo bem em Recife?"
  );
  assert.equal(renderTemplate("{empresa} do ramo de {nicho}", P), "Padaria do Zé do ramo de alimentação");
});

test("renderTemplate: case-insensitive nos placeholders", () => {
  assert.equal(renderTemplate("Olá {NOME}", P), "Olá Padaria do Zé");
});

test("renderTemplate: placeholder desconhecido fica literal (gestor vê e corrige)", () => {
  assert.equal(renderTemplate("Oi {nomee}", P), "Oi {nomee}");
});

test("renderTemplate: valor ausente vira '' e limpa espaço antes de pontuação", () => {
  const semNome = { nome_empresa: null, cidade: null, nicho: null };
  assert.equal(renderTemplate("Olá {nome}, temos uma oferta!", semNome), "Olá, temos uma oferta!");
  assert.equal(renderTemplate("Oi {nome} {nome}!", semNome), "Oi!");
});

test("renderTemplate: sem placeholders devolve o texto (trim)", () => {
  assert.equal(renderTemplate("  Promoção só hoje  ", P), "Promoção só hoje");
});

test("renderTemplate: limpa espaço no fim das linhas", () => {
  const semCidade = { nome_empresa: "Loja", cidade: null, nicho: null };
  assert.equal(renderTemplate("Linha um {cidade}\nLinha dois", semCidade), "Linha um\nLinha dois");
});

test("validarMensagemDisparo: vazio -> erro", () => {
  assert.ok(validarMensagemDisparo(""));
  assert.ok(validarMensagemDisparo("   "));
});

test("validarMensagemDisparo: dentro do limite -> null", () => {
  assert.equal(validarMensagemDisparo("Oferta de inauguração para {nome}!"), null);
});

test("validarMensagemDisparo: acima de 1000 chars -> erro", () => {
  assert.ok(validarMensagemDisparo("a".repeat(1001)));
});

test("validarMensagemDisparo: só placeholders (sem texto literal) -> erro", () => {
  // '{nome}' renderiza vazio para quem não tem nome; exige conteúdo literal.
  assert.ok(validarMensagemDisparo("{nome}"));
  assert.ok(validarMensagemDisparo("{nome} {cidade}"));
  assert.equal(validarMensagemDisparo("Olá {nome}!"), null);
});

test("erroDeColunaAusente: casa 42703 (SELECT) e PGRST204 (write) e mensagem", () => {
  assert.equal(erroDeColunaAusente({ code: "42703" }), true);
  assert.equal(erroDeColunaAusente({ code: "PGRST204" }), true);
  assert.equal(
    erroDeColunaAusente({ message: "Could not find the 'prospect_modo' column ... in the schema cache" }),
    true
  );
  assert.equal(erroDeColunaAusente({ code: "PGRST301", message: "jwt expired" }), false);
  assert.equal(erroDeColunaAusente(null), false);
  assert.equal(erroDeColunaAusente(undefined), false);
});
