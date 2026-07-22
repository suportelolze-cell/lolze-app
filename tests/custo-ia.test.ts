import { test } from "node:test";
import assert from "node:assert/strict";

// Taxa fixa para tornar o custo determinístico (custo.ts lê USD_BRL em runtime).
process.env.USD_BRL = "5";

const { custoUsd, custoBRLCents } = await import("../src/lib/agent/custo.ts");
const { resumirCustos } = await import("../src/lib/admin/custos-core.ts");

const ZERO = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };

test("custoUsd aplica a tabela de preços por tipo de token", () => {
  // 1M input = $3; 1M output = $15; 1M cache-write = $3.75; 1M cache-read = $0.30
  assert.equal(custoUsd({ ...ZERO, inputTokens: 1_000_000 }), 3);
  assert.equal(custoUsd({ ...ZERO, outputTokens: 1_000_000 }), 15);
  assert.equal(custoUsd({ ...ZERO, cacheCreation: 1_000_000 }), 3.75);
  assert.equal(Math.round(custoUsd({ ...ZERO, cacheRead: 1_000_000 }) * 100) / 100, 0.3);
});

test("custoBRLCents converte USD→BRL (USD_BRL=5) e vira centavos", () => {
  // 1M output = $15 * 5 = R$75 = 7500 centavos
  assert.equal(custoBRLCents({ ...ZERO, outputTokens: 1_000_000 }), 7500);
  // uso zero = custo zero
  assert.equal(custoBRLCents(ZERO), 0);
});

const linha = (o: Partial<{ tenantId: string; nome: string; plano: string; status: string; mensalCents: number; custoCents: number; chamadas: number }>) => ({
  tenantId: o.tenantId ?? "t",
  nome: o.nome ?? "T",
  plano: o.plano ?? "p",
  status: o.status ?? "ativo",
  mensalCents: o.mensalCents ?? 0,
  custoCents: o.custoCents ?? 0,
  chamadas: o.chamadas ?? 0,
});

test("resumirCustos: margem por tenant = (mensalidade - custo IA) / mensalidade", () => {
  const r = resumirCustos([linha({ tenantId: "a", nome: "Cliente A", mensalCents: 100_000, custoCents: 7500, chamadas: 10 })]);
  const a = r.tenants[0];
  assert.equal(a.custoCents, 7500);
  assert.equal(a.receitaCents, 100_000);
  assert.equal(a.margemCents, 92_500);
  assert.equal(a.margemPct, 92.5);
});

test("plano sem preço (mensalidade 0) → margem null, não divide por zero", () => {
  const r = resumirCustos([linha({ tenantId: "x", mensalCents: 0, custoCents: 200 })]);
  assert.equal(r.tenants[0].margemPct, null);
  assert.equal(r.margemGlobalPct, null); // receita total 0
});

test("ordena piores margens primeiro; sem receita vai pro fim", () => {
  const r = resumirCustos([
    linha({ tenantId: "bom", mensalCents: 100_000, custoCents: 0 }), // 100%
    linha({ tenantId: "ruim", mensalCents: 10_000, custoCents: 7500 }), // 25%
    linha({ tenantId: "semreceita", mensalCents: 0, custoCents: 0 }),
  ]);
  assert.deepEqual(r.tenants.map((t) => t.tenantId), ["ruim", "bom", "semreceita"]);
});

test("totais e margem global agregam corretamente", () => {
  const r = resumirCustos([
    linha({ tenantId: "a", mensalCents: 100_000, custoCents: 7500 }),
    linha({ tenantId: "b", mensalCents: 100_000, custoCents: 7500 }),
  ]);
  assert.equal(r.totalReceitaCents, 200_000);
  assert.equal(r.totalCustoCents, 15_000);
  assert.equal(r.margemGlobalPct, 92.5);
});
