import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resumirFunilLolze,
  normalizarJanelaFunil,
  type LinhaFunilLolze,
} from "../src/lib/admin/funil-lolze-core.ts";

function linha(evento: string): LinhaFunilLolze {
  return { evento, created_at: "2026-07-01T12:00:00Z", dados: {} };
}

test("vazio → sem dados, topo e jornada zerados", () => {
  const r = resumirFunilLolze([], null);
  assert.equal(r.temDados, false);
  assert.equal(r.total, 0);
  assert.equal(r.topo.length, 2);
  assert.equal(r.jornada.length, 5);
  assert.ok(r.topo.every((t) => t.total === 0));
  assert.ok(r.jornada.every((j) => j.total === 0));
});

test("normalizarJanelaFunil: null=tudo; 7/30/90 passam; resto vira 30", () => {
  assert.equal(normalizarJanelaFunil(null), null);
  assert.equal(normalizarJanelaFunil(undefined), null);
  assert.equal(normalizarJanelaFunil(7), 7);
  assert.equal(normalizarJanelaFunil(90), 90);
  assert.equal(normalizarJanelaFunil(45), 30);
});

test("topo conta diagnóstico e demo separadamente (demo é por mensagem)", () => {
  const rows = [
    linha("diagnostico_interagido"),
    linha("diagnostico_interagido"),
    linha("demo_mensagem"),
    linha("demo_mensagem"),
    linha("demo_mensagem"),
  ];
  const r = resumirFunilLolze(rows, null);
  const diag = r.topo.find((t) => t.chave === "diagnostico");
  const demo = r.topo.find((t) => t.chave === "demo");
  assert.equal(diag?.total, 2);
  assert.equal(demo?.total, 3);
});

test("jornada: contagem e conversão da base e da etapa anterior", () => {
  const rows = [
    linha("aplicacao_enviada"),
    linha("aplicacao_enviada"),
    linha("aplicacao_enviada"),
    linha("aplicacao_enviada"), // 4 aplicações
    linha("cadastro_criado"),
    linha("cadastro_criado"), // 2 cadastros
    linha("checkout_iniciado"), // 1 checkout
    linha("pagamento_confirmado"), // 1 pagamento
    linha("onboarding_concluido"), // 1 ativação
  ];
  const r = resumirFunilLolze(rows, null);
  const totais = r.jornada.map((j) => j.total);
  assert.deepEqual(totais, [4, 2, 1, 1, 1]);

  const [aplic, cad, chk] = r.jornada;
  assert.equal(aplic.pctBase, 100);
  assert.equal(aplic.pctAnterior, null); // base não tem anterior
  assert.equal(cad.pctBase, 50); // 2/4
  assert.equal(cad.pctAnterior, 50); // 2/4
  assert.equal(chk.pctAnterior, 50); // 1/2
  assert.equal(chk.pctBase, 25); // 1/4
});

test("eventos desconhecidos não entram no funil e não quebram", () => {
  const rows = [linha("evento_qualquer"), linha("aplicacao_enviada")];
  const r = resumirFunilLolze(rows, null);
  assert.equal(r.total, 2); // total conta todas as linhas lidas
  assert.equal(r.jornada[0].total, 1); // só 1 aplicação
});
