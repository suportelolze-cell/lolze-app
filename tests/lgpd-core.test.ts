import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PII_LEAD_PATCH,
  AGENDAMENTO_ANON_PATCH,
  anonimizarDadosEvento,
  TABELAS_DUMP_TENANT,
  ORFAOS_TENANT,
  montarExportLead,
  montarDumpTenant,
} from "../src/lib/lgpd/lgpd-core.ts";

test("dump do tenant NUNCA lista a tabela de segredos", () => {
  const tabelas: readonly string[] = TABELAS_DUMP_TENANT;
  assert.ok(!tabelas.includes("app_tenant_secrets"));
});

test("montarDumpTenant descarta app_tenant_secrets mesmo se vier na entrada", () => {
  const d = montarDumpTenant("2026-07-28", "t1", {
    app_config: [{ a: 1 }],
    app_tenant_secrets: [{ token: "sk_secreto" }],
  });
  assert.equal(d.tabelas.app_tenant_secrets, undefined);
  assert.deepEqual(d.tabelas.app_config, [{ a: 1 }]);
  assert.equal(d.formato, "lgpd-dump-conta-v1");
});

test("órfãos do tenant são exatamente os 4 sem FK ao tenant", () => {
  assert.deepEqual(
    [...ORFAOS_TENANT].sort(),
    ["app_erros", "app_ideias", "app_prospects", "app_uso_ia"]
  );
});

test("PII_LEAD_PATCH zera a PII e NÃO mexe no valor financeiro", () => {
  assert.equal(PII_LEAD_PATCH.nome, "[removido]");
  assert.equal(PII_LEAD_PATCH.telefone, null);
  assert.equal(PII_LEAD_PATCH.email, null);
  assert.equal(PII_LEAD_PATCH.diagnostico, null);
  assert.equal(PII_LEAD_PATCH.canal_user_id, null);
  assert.equal(PII_LEAD_PATCH.proximo_followup, null);
  assert.ok(!("valor" in PII_LEAD_PATCH));
  assert.ok(!("tenant_id" in PII_LEAD_PATCH));
});

test("AGENDAMENTO_ANON_PATCH zera nome/telefone/servico/notas/google_event_id", () => {
  assert.equal(AGENDAMENTO_ANON_PATCH.nome, "[removido]");
  for (const k of ["telefone", "servico", "notas", "google_event_id"]) {
    assert.equal(AGENDAMENTO_ANON_PATCH[k], null);
  }
});

test("anonimizarDadosEvento é allowlist: mantém valor_cents, descarta PII", () => {
  const out = anonimizarDadosEvento({
    valor_cents: 5000,
    nome: "Fulano",
    telefone: "5519999990000",
    texto: "mensagem privada",
    email: "x@y.com",
  });
  assert.deepEqual(out, { valor_cents: 5000 });
});

test("anonimizarDadosEvento tolera null/undefined/entrada estranha", () => {
  assert.deepEqual(anonimizarDadosEvento(null), {});
  assert.deepEqual(anonimizarDadosEvento(undefined), {});
  assert.deepEqual(anonimizarDadosEvento({ so_pii: "x" }), {});
});

test("montarExportLead inclui todas as seções do titular", () => {
  const pkg = montarExportLead({
    geradoEm: "2026-07-28T00:00:00Z",
    tenantId: "t1",
    leadId: 7,
    lead: { id: 7, nome: "X" },
    mensagens: [{ id: 1 }],
    agendamentos: [],
    lead_canais: [],
    eventos: [{ tipo: "sale_won" }],
    agent_runs: [],
    erros: [],
  });
  assert.equal(pkg.formato, "lgpd-portabilidade-v1");
  assert.equal(pkg.lead_id, 7);
  assert.ok(Array.isArray(pkg.conversas));
  assert.ok(Array.isArray(pkg.eventos));
  assert.ok(Array.isArray(pkg.interacoes_ia));
});
