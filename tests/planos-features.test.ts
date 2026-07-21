import { test } from "node:test";
import assert from "node:assert/strict";
import { planoTemFeature, planoMinimoPara } from "../src/lib/planos/features.ts";

test("start não libera nenhuma feature", () => {
  assert.equal(planoTemFeature("start", "anuncios"), false);
  assert.equal(planoTemFeature("start", "instagram"), false);
  assert.equal(planoTemFeature("start", "metaAds"), false);
});

test("growth libera anuncios e instagram, mas NÃO metaAds", () => {
  assert.equal(planoTemFeature("growth", "anuncios"), true);
  assert.equal(planoTemFeature("growth", "instagram"), true);
  assert.equal(planoTemFeature("growth", "metaAds"), false);
});

test("scale e enterprise liberam tudo, incluindo metaAds", () => {
  for (const p of ["scale", "enterprise"]) {
    assert.equal(planoTemFeature(p, "anuncios"), true);
    assert.equal(planoTemFeature(p, "instagram"), true);
    assert.equal(planoTemFeature(p, "metaAds"), true);
  }
});

test("FAIL-CLOSED: plano desconhecido/nulo não libera nada", () => {
  assert.equal(planoTemFeature("plano_novo_qualquer", "instagram"), false);
  assert.equal(planoTemFeature(null, "instagram"), false);
  assert.equal(planoTemFeature(undefined, "anuncios"), false);
  assert.equal(planoTemFeature("", "metaAds"), false);
});

test("é case-insensitive", () => {
  assert.equal(planoTemFeature("GROWTH", "instagram"), true);
  assert.equal(planoTemFeature("Scale", "metaAds"), true);
});

test("planoMinimoPara aponta o menor plano que libera", () => {
  assert.equal(planoMinimoPara("instagram"), "Growth");
  assert.equal(planoMinimoPara("anuncios"), "Growth");
  assert.equal(planoMinimoPara("metaAds"), "Scale");
});
