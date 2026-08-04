import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarCustomerId,
  montarGaql,
  mapearLinhas,
  moedaDasLinhas,
  type GoogleAdsRow,
} from "../src/lib/trafego/google-core.ts";

test("normalizarCustomerId: aceita com hífens e sem", () => {
  assert.equal(normalizarCustomerId("123-456-7890"), "1234567890");
  assert.equal(normalizarCustomerId("1234567890"), "1234567890");
  assert.equal(normalizarCustomerId("  123-456-7890  "), "1234567890");
});

test("normalizarCustomerId: id inválido (≠10 dígitos) vira ''", () => {
  assert.equal(normalizarCustomerId(""), "");
  assert.equal(normalizarCustomerId("123"), "");
  assert.equal(normalizarCustomerId("12345678901"), "");
  assert.equal(normalizarCustomerId("abc"), "");
});

test("mapearLinhas: cost_micros vira cents e cliques", () => {
  const rows: GoogleAdsRow[] = [
    { segments: { date: "2026-08-01" }, metrics: { costMicros: "12340000", clicks: "40" } },
  ];
  assert.deepEqual(mapearLinhas(rows), [
    { dia: "2026-08-01", cliques: 40, investimentoCents: 1234, visitantes: 0 },
  ]);
});

test("mapearLinhas: arredonda micros fracionário para cents", () => {
  // 12.345.678 micros = R$ 12,345678 -> 1234,5678 cents -> round -> 1235
  const rows: GoogleAdsRow[] = [{ segments: { date: "2026-08-02" }, metrics: { costMicros: "12345678" } }];
  assert.equal(mapearLinhas(rows)[0].investimentoCents, 1235);
});

test("mapearLinhas: aceita costMicros/clicks como number", () => {
  const rows: GoogleAdsRow[] = [{ segments: { date: "2026-08-03" }, metrics: { costMicros: 5000000, clicks: 7 } }];
  const out = mapearLinhas(rows)[0];
  assert.equal(out.investimentoCents, 500);
  assert.equal(out.cliques, 7);
});

test("mapearLinhas: descarta linhas sem date válido; valores ausentes -> 0", () => {
  const rows: GoogleAdsRow[] = [
    { metrics: { costMicros: "1000000" } },
    { segments: { date: "lixo" }, metrics: { clicks: "3" } },
    { segments: { date: "2026-08-03" }, metrics: {} },
  ];
  const out = mapearLinhas(rows);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { dia: "2026-08-03", cliques: 0, investimentoCents: 0, visitantes: 0 });
});

test("mapearLinhas: deduplica por dia (última vence)", () => {
  const rows: GoogleAdsRow[] = [
    { segments: { date: "2026-08-02" }, metrics: { costMicros: "1000000", clicks: "2" } },
    { segments: { date: "2026-08-02" }, metrics: { costMicros: "3000000", clicks: "9" } },
  ];
  const out = mapearLinhas(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].investimentoCents, 300);
  assert.equal(out[0].cliques, 9);
});

test("moedaDasLinhas: pega a primeira currency_code presente", () => {
  assert.equal(
    moedaDasLinhas([{ segments: { date: "2026-08-01" } }, { customer: { currencyCode: "BRL" } }]),
    "BRL"
  );
  assert.equal(moedaDasLinhas([{ segments: { date: "2026-08-01" } }]), null);
  assert.equal(moedaDasLinhas([]), null);
});

test("montarGaql: inclui a janela e os campos esperados", () => {
  const q = montarGaql("2026-08-01", "2026-08-03");
  assert.match(q, /segments\.date/);
  assert.match(q, /metrics\.cost_micros/);
  assert.match(q, /metrics\.clicks/);
  assert.match(q, /customer\.currency_code/);
  assert.match(q, /BETWEEN '2026-08-01' AND '2026-08-03'/);
});
