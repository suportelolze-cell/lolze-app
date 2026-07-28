import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tipoDeMime,
  tipoCanal,
  dentroDoLimite,
  extDeNome,
  LIMITES_MIDIA,
  limiteMb,
} from "../src/lib/atendimento/midia-core.ts";

test("tipoDeMime classifica imagem/video/audio/documento", () => {
  assert.equal(tipoDeMime("image/jpeg"), "imagem");
  assert.equal(tipoDeMime("image/png"), "imagem");
  assert.equal(tipoDeMime("video/mp4"), "video");
  assert.equal(tipoDeMime("audio/ogg"), "audio");
  assert.equal(tipoDeMime("application/pdf"), "documento");
  assert.equal(tipoDeMime("text/csv"), "documento");
  assert.equal(tipoDeMime("application/vnd.ms-excel"), "documento");
});

test("tipoDeMime manda heic/webp/gif como documento (WhatsApp só aceita jpeg/png como imagem)", () => {
  assert.equal(tipoDeMime("image/heic"), "documento");
  assert.equal(tipoDeMime("image/heif"), "documento");
  assert.equal(tipoDeMime("image/webp"), "documento");
  assert.equal(tipoDeMime("image/gif"), "documento");
});

test("tipoDeMime devolve null para não suportado/vazio", () => {
  assert.equal(tipoDeMime(""), null);
  assert.equal(tipoDeMime("model/gltf-binary"), null);
});

test("tipoCanal mapeia pt -> en", () => {
  assert.equal(tipoCanal("imagem"), "image");
  assert.equal(tipoCanal("documento"), "document");
  assert.equal(tipoCanal("video"), "video");
  assert.equal(tipoCanal("audio"), "audio");
});

test("dentroDoLimite respeita os limites por tipo", () => {
  assert.equal(dentroDoLimite("imagem", 1), true);
  assert.equal(dentroDoLimite("imagem", LIMITES_MIDIA.imagem), true);
  assert.equal(dentroDoLimite("imagem", LIMITES_MIDIA.imagem + 1), false);
  assert.equal(dentroDoLimite("video", LIMITES_MIDIA.video), true);
  assert.equal(dentroDoLimite("imagem", 0), false);
  assert.equal(dentroDoLimite("imagem", -5), false);
  assert.equal(dentroDoLimite("imagem", NaN), false);
});

test("extDeNome extrai a extensão (ou 'bin')", () => {
  assert.equal(extDeNome("tabela-precos.pdf"), "pdf");
  assert.equal(extDeNome("FOTO.JPG"), "jpg");
  assert.equal(extDeNome("sem-extensao"), "bin");
  assert.equal(extDeNome(""), "bin");
});

test("limiteMb devolve o limite em MB", () => {
  assert.equal(limiteMb("imagem"), 5);
  assert.equal(limiteMb("video"), 16);
  assert.equal(limiteMb("documento"), 100);
});
