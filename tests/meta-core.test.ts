import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarAdAccountId,
  mapearInsights,
  janelaSync,
  type MetaInsight,
} from "../src/lib/trafego/meta-core.ts";

test("normalizarAdAccountId: aceita com e sem prefixo act_", () => {
  assert.equal(normalizarAdAccountId("123456"), "act_123456");
  assert.equal(normalizarAdAccountId("act_123456"), "act_123456");
  assert.equal(normalizarAdAccountId("ACT_123456"), "act_123456");
  assert.equal(normalizarAdAccountId("  act_123456  "), "act_123456");
});

test("normalizarAdAccountId: id inválido vira '' (não configurado)", () => {
  assert.equal(normalizarAdAccountId(""), "");
  assert.equal(normalizarAdAccountId("   "), "");
  assert.equal(normalizarAdAccountId("act_"), "");
  assert.equal(normalizarAdAccountId("abc123"), "");
  assert.equal(normalizarAdAccountId("act_12x3"), "");
});

test("mapearInsights: gasto vira cents (arredondado) e cliques/visitantes", () => {
  const rows: MetaInsight[] = [
    {
      date_start: "2026-08-01",
      spend: "12.34",
      inline_link_clicks: "40",
      actions: [{ action_type: "landing_page_views", value: "30" }],
    },
  ];
  assert.deepEqual(mapearInsights(rows), [
    { dia: "2026-08-01", cliques: 40, investimentoCents: 1234, visitantes: 30 },
  ]);
});

test("mapearInsights: arredondamento de gasto fracionário (meio centavo)", () => {
  const rows: MetaInsight[] = [{ date_start: "2026-08-02", spend: "0.005" }];
  // 0.005 * 100 = 0.5 -> round -> 1 cent
  assert.equal(mapearInsights(rows)[0].investimentoCents, 1);
  assert.equal(mapearInsights([{ date_start: "2026-08-02", spend: "99.994" }])[0].investimentoCents, 9999);
});

test("mapearInsights: usa inline_link_clicks quando presente (mesmo 0)", () => {
  const rows: MetaInsight[] = [{ date_start: "2026-08-03", spend: "5", inline_link_clicks: 0 }];
  // link clicks presente e = 0: respeita
  assert.equal(mapearInsights(rows)[0].cliques, 0);
});

test("mapearInsights: sem inline_link_clicks -> cliques 0 (NÃO usa o total de clicks)", () => {
  // Dia com entrega mas 0 cliques de link: o Meta omite inline_link_clicks.
  // Não caímos para o total de clicks (curtidas/reações), que inflaria o funil.
  const rows: MetaInsight[] = [{ date_start: "2026-08-03", spend: "5" }];
  assert.equal(mapearInsights(rows)[0].cliques, 0);
});

test("mapearInsights: sem landing_page_views -> visitantes 0", () => {
  const rows: MetaInsight[] = [
    { date_start: "2026-08-03", spend: "5", inline_link_clicks: "1", actions: [{ action_type: "link_click", value: "9" }] },
  ];
  assert.equal(mapearInsights(rows)[0].visitantes, 0);
});

test("mapearInsights: descarta linhas sem date_start válido", () => {
  const rows: MetaInsight[] = [
    { spend: "5", inline_link_clicks: "1" },
    { date_start: "lixo", spend: "5" },
    { date_start: "2026-08-03", spend: "5", inline_link_clicks: "2" },
  ];
  const out = mapearInsights(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].dia, "2026-08-03");
});

test("mapearInsights: valores ausentes/lixo viram 0 (nunca NaN/negativo)", () => {
  const rows: MetaInsight[] = [
    { date_start: "2026-08-03", spend: "abc", inline_link_clicks: "x", actions: [{ action_type: "landing_page_views", value: "-5" }] },
  ];
  const out = mapearInsights(rows)[0];
  assert.equal(out.investimentoCents, 0);
  assert.equal(out.cliques, 0);
  assert.equal(out.visitantes, 0); // clamp em 0 (não negativo)
});

test("mapearInsights: array vazio / undefined -> []", () => {
  assert.deepEqual(mapearInsights([]), []);
  assert.deepEqual(mapearInsights(undefined as unknown as MetaInsight[]), []);
});

test("mapearInsights: deduplica por dia (última linha vence) -> upsert em lote não quebra", () => {
  const rows: MetaInsight[] = [
    { date_start: "2026-08-02", spend: "10", inline_link_clicks: "3" },
    { date_start: "2026-08-02", spend: "25", inline_link_clicks: "9" }, // mesma data
  ];
  const out = mapearInsights(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].dia, "2026-08-02");
  assert.equal(out[0].investimentoCents, 2500); // última vence
  assert.equal(out[0].cliques, 9);
});

test("janelaSync: dias=1 -> since == until (só hoje)", () => {
  const { since, until } = janelaSync("2026-08-03", 1);
  assert.equal(since, "2026-08-03");
  assert.equal(until, "2026-08-03");
});

test("janelaSync: janela de 3 dias inclui hoje", () => {
  const { since, until } = janelaSync("2026-08-03", 3);
  assert.equal(since, "2026-08-01");
  assert.equal(until, "2026-08-03");
});

test("janelaSync: atravessa a virada de mês corretamente", () => {
  const { since, until } = janelaSync("2026-08-02", 3);
  assert.equal(since, "2026-07-31");
  assert.equal(until, "2026-08-02");
});
