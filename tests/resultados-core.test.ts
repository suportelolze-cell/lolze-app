import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agregarResultados,
  normalizarJanela,
  FUNIL,
  type EventoRow,
} from "../src/lib/resultados-core.ts";

// Helper: monta um evento com defaults, sobrescrevendo o que interessa ao caso.
function ev(p: Partial<EventoRow> & { tipo: string }): EventoRow {
  return {
    tipo: p.tipo,
    lead_id: p.lead_id ?? null,
    canal: p.canal ?? null,
    origem: p.origem ?? null,
    valor_cents: p.valor_cents ?? null,
    created_at: p.created_at ?? "2026-07-01T12:00:00.000Z",
  };
}

test("ledger vazio → sem dados, tudo zerado, 6 etapas", () => {
  const r = agregarResultados([], 30);
  assert.equal(r.temDados, false);
  assert.equal(r.totalEventos, 0);
  assert.equal(r.vendas, 0);
  assert.equal(r.receitaConfirmada, 0);
  assert.equal(r.etapas.length, FUNIL.length);
  assert.ok(r.etapas.every((e) => e.total === 0));
});

test("normalizarJanela só aceita 7/30/90; resto vira 30", () => {
  assert.equal(normalizarJanela(7), 7);
  assert.equal(normalizarJanela(30), 30);
  assert.equal(normalizarJanela(90), 90);
  assert.equal(normalizarJanela(1), 30);
  assert.equal(normalizarJanela(45), 30);
  assert.equal(normalizarJanela(-5), 30);
});

test("funil: contagem por etapa, conversão da base e da etapa anterior", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "lead_received", lead_id: 1, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "lead_received", lead_id: 2, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "lead_received", lead_id: 3, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "first_response_sent", lead_id: 1, created_at: "2026-07-01T12:02:00Z" }),
    ev({ tipo: "first_response_sent", lead_id: 2, created_at: "2026-07-01T12:10:00Z" }),
    ev({ tipo: "qualified", lead_id: 1 }),
    ev({ tipo: "appointment_booked", lead_id: 1 }),
    ev({ tipo: "appointment_attended", lead_id: 1 }),
    ev({ tipo: "sale_won", lead_id: 1 }),
    ev({ tipo: "revenue_confirmed", lead_id: 1, valor_cents: 30000, canal: "whatsapp" }),
  ];
  const r = agregarResultados(evs, 30);

  assert.equal(r.temDados, true);
  const totais = r.etapas.map((e) => e.total);
  assert.deepEqual(totais, [3, 2, 1, 1, 1, 1]);

  // base = 3 leads recebidos
  assert.equal(r.etapas[0].pctDoAnterior, null); // base não tem "anterior"
  assert.equal(r.etapas[0].pctDaBase, 100);
  assert.equal(r.etapas[1].pctDaBase, 66.7); // 2/3
  assert.equal(r.etapas[1].pctDoAnterior, 66.7); // 2/3 vindo da base
  assert.equal(r.etapas[2].pctDoAnterior, 50); // 1/2 qualificados vindos de respondidos
});

test("receita: soma revenue_confirmed, ticket médio e atribuição por canal", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "sale_won", lead_id: 1 }),
    ev({ tipo: "sale_won", lead_id: 2 }),
    ev({ tipo: "revenue_confirmed", lead_id: 1, valor_cents: 30000, canal: "whatsapp" }),
    ev({ tipo: "revenue_confirmed", lead_id: 2, valor_cents: 10000, canal: "instagram" }),
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.vendas, 2);
  assert.equal(r.receitaConfirmada, 400); // R$ 300 + R$ 100
  assert.equal(r.ticketMedio, 200);
  assert.deepEqual(
    r.canais.map((c) => [c.canal, c.receita, c.vendas]),
    [
      ["WhatsApp", 300, 1],
      ["Instagram", 100, 1],
    ]
  );
});

test("sale_won não deve contar valor de receita (só revenue_confirmed carrega valor)", () => {
  // confirmarReceita grava sale_won E revenue_confirmed com o mesmo valor;
  // a receita só pode vir de revenue_confirmed, senão duplicaria.
  const evs: EventoRow[] = [
    ev({ tipo: "sale_won", lead_id: 1, valor_cents: 30000 }),
    ev({ tipo: "revenue_confirmed", lead_id: 1, valor_cents: 30000, canal: "whatsapp" }),
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.receitaConfirmada, 300); // não 600
});

test("dedup: mesmo lead com eventos repetidos conta uma vez na etapa", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "lead_received", lead_id: 7 }),
    ev({ tipo: "lead_received", lead_id: 7 }), // duplicado
    ev({ tipo: "lead_received", lead_id: 8 }),
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.etapas[0].total, 2); // 2 leads distintos, não 3
});

test("atribuição: canal nulo cai em origem; ambos nulos viram 'Direto'", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "revenue_confirmed", lead_id: 1, valor_cents: 5000, canal: null, origem: "site" }),
    ev({ tipo: "revenue_confirmed", lead_id: 2, valor_cents: 5000, canal: null, origem: null }),
  ];
  const r = agregarResultados(evs, 30);
  const nomes = r.canais.map((c) => c.canal).sort();
  assert.deepEqual(nomes, ["Direto", "Site"]);
});

test("valor_cents nulo em revenue_confirmed não quebra e conta como zero", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "sale_won", lead_id: 1 }),
    ev({ tipo: "revenue_confirmed", lead_id: 1, valor_cents: null, canal: "whatsapp" }),
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.receitaConfirmada, 0);
  assert.equal(r.vendas, 1);
  assert.equal(r.ticketMedio, 0);
});

test("SLA da 1ª resposta: mediana em minutos e % até 5 min", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "lead_received", lead_id: 1, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "first_response_sent", lead_id: 1, created_at: "2026-07-01T12:02:00Z" }), // 2 min
    ev({ tipo: "lead_received", lead_id: 2, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "first_response_sent", lead_id: 2, created_at: "2026-07-01T12:10:00Z" }), // 10 min
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.leadsComResposta, 2);
  assert.equal(r.slaMedianaMin, 6); // mediana de [2, 10]
  assert.equal(r.pctRespondidoAte5min, 50); // só o de 2 min entra
});

test("SLA usa o PRIMEIRO recebido e a PRIMEIRA resposta do lead", () => {
  const evs: EventoRow[] = [
    ev({ tipo: "lead_received", lead_id: 1, created_at: "2026-07-01T12:00:00Z" }),
    ev({ tipo: "lead_received", lead_id: 1, created_at: "2026-07-01T12:30:00Z" }), // posterior, ignorado
    ev({ tipo: "first_response_sent", lead_id: 1, created_at: "2026-07-01T12:03:00Z" }),
    ev({ tipo: "first_response_sent", lead_id: 1, created_at: "2026-07-01T12:20:00Z" }), // posterior, ignorado
  ];
  const r = agregarResultados(evs, 30);
  assert.equal(r.slaMedianaMin, 3);
});
