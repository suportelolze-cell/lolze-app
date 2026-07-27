import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarAlertas, PCT_TETO_ALERTA } from "../src/lib/admin/alertas-core.ts";

const base = {
  tenantId: "t1",
  nome: "Cliente 1",
  agenteAtivo: true,
  whatsappConectado: true,
  instagramConfigurado: false,
  errosAltos24h: 0,
  deadLetters: 0,
  custoCents: 0,
  tetoCents: 100000,
};

test("tenant saudável não gera alerta", () => {
  const r = classificarAlertas([base]);
  assert.equal(r.alertas.length, 0);
  assert.equal(r.criticos, 0);
  assert.equal(r.tenantsComAlerta, 0);
});

test("IA ativa sem nenhum canal → crítico", () => {
  const r = classificarAlertas([{ ...base, whatsappConectado: false, instagramConfigurado: false }]);
  const a = r.alertas.find((x) => x.tipo === "sem_canal");
  assert.ok(a);
  assert.equal(a.severidade, "critico");
});

test("IA ativa com Instagram (sem WhatsApp) NÃO gera 'sem_canal'", () => {
  const r = classificarAlertas([{ ...base, whatsappConectado: false, instagramConfigurado: true }]);
  assert.equal(r.alertas.find((x) => x.tipo === "sem_canal"), undefined);
});

test("dead-letters → crítico", () => {
  const r = classificarAlertas([{ ...base, deadLetters: 3 }]);
  const a = r.alertas.find((x) => x.tipo === "dead_letter");
  assert.ok(a);
  assert.equal(a.severidade, "critico");
  assert.match(a.mensagem, /3/);
});

test("custo: atenção a partir do limiar; crítico ao estourar o teto", () => {
  const atencao = classificarAlertas([{ ...base, custoCents: Math.round(base.tetoCents * PCT_TETO_ALERTA) }]);
  const aA = atencao.alertas.find((x) => x.tipo === "custo_teto");
  assert.ok(aA);
  assert.equal(aA.severidade, "atencao");

  const critico = classificarAlertas([{ ...base, custoCents: base.tetoCents + 1 }]);
  assert.equal(critico.alertas.find((x) => x.tipo === "custo_teto")?.severidade, "critico");
});

test("teto 0 (ilimitado) nunca gera alerta de custo", () => {
  const r = classificarAlertas([{ ...base, tetoCents: 0, custoCents: 9_999_999 }]);
  assert.equal(r.alertas.find((x) => x.tipo === "custo_teto"), undefined);
});

test("IA desligada e erros altos → atenção", () => {
  const r = classificarAlertas([{ ...base, agenteAtivo: false, errosAltos24h: 5 }]);
  assert.ok(r.alertas.find((x) => x.tipo === "agente_off" && x.severidade === "atencao"));
  assert.ok(r.alertas.find((x) => x.tipo === "erros" && x.severidade === "atencao"));
});

test("críticos vêm antes dos de atenção na ordenação", () => {
  const r = classificarAlertas([{ ...base, agenteAtivo: false, deadLetters: 1, errosAltos24h: 2 }]);
  // agente_off gera 'atencao'; dead_letter gera 'critico' → crítico primeiro
  assert.equal(r.alertas[0].severidade, "critico");
});

test("contadores e tenantsComAlerta agregam por cliente", () => {
  const r = classificarAlertas([
    { ...base, tenantId: "a", nome: "A", deadLetters: 1, agenteAtivo: false }, // 1 crít + 1 aten
    { ...base, tenantId: "b", nome: "B" }, // saudável
  ]);
  assert.equal(r.criticos, 1);
  assert.equal(r.atencao, 1);
  assert.equal(r.tenantsComAlerta, 1);
});
