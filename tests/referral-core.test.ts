import { test } from "node:test";
import assert from "node:assert/strict";
import { anuncioDoReferral } from "../src/lib/whatsapp/referral-core.ts";

test("anuncioDoReferral: sem referral -> null (orgânico)", () => {
  assert.equal(anuncioDoReferral(null), null);
  assert.equal(anuncioDoReferral(undefined), null);
  assert.equal(anuncioDoReferral({}), null);
});

test("anuncioDoReferral: prefere o headline", () => {
  assert.equal(
    anuncioDoReferral({ headline: "Promoção de inverno", source_id: "120210" }),
    "Promoção de inverno"
  );
});

test("anuncioDoReferral: sem headline -> id cru (mesmo formato da Evolution)", () => {
  assert.equal(anuncioDoReferral({ source_id: "120210", source_type: "ad" }), "120210");
});

test("anuncioDoReferral: sem título/id -> url; sem nada -> 'anúncio'", () => {
  assert.equal(anuncioDoReferral({ source_url: "https://fb.com/ad/1" }), "https://fb.com/ad/1");
  assert.equal(anuncioDoReferral({ source_type: "ad" }), "anúncio");
});

test("anuncioDoReferral: ctwa_clid conta como tráfego pago (rótulo genérico)", () => {
  // Referral só com o click id ainda é pago — não pode virar orgânico.
  assert.equal(anuncioDoReferral({ ctwa_clid: "IwAR0abc" }), "anúncio");
});

test("anuncioDoReferral: aparas de espaço", () => {
  assert.equal(anuncioDoReferral({ headline: "  Oferta  " }), "Oferta");
  assert.equal(anuncioDoReferral({ source_id: "  99  " }), "99");
});
