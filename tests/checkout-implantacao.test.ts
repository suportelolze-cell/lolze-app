import { test } from "node:test";
import assert from "node:assert/strict";
import { montarParamsCheckout } from "../src/lib/stripe/client.ts";

const base = {
  tenantId: "tid-1",
  priceId: "price_mensal",
  baseUrl: "https://app.exemplo.com",
};

test("checkout base é assinatura com o preço recorrente e metadados do tenant", () => {
  const p = montarParamsCheckout(base);
  assert.equal(p["mode"], "subscription");
  assert.equal(p["line_items[0][price]"], "price_mensal");
  assert.equal(p["metadata[tenant_id]"], "tid-1");
  assert.equal(p["subscription_data[metadata][tenant_id]"], "tid-1");
  // sem implantação/carência quando não passados
  assert.equal(p["line_items[1][price_data][unit_amount]"], undefined);
  assert.equal(p["subscription_data[trial_period_days]"], undefined);
});

test("implantação vira item avulso (price_data) cobrado no checkout", () => {
  const p = montarParamsCheckout({ ...base, setupCents: 250000, nomePlano: "Growth" });
  assert.equal(p["line_items[1][price_data][currency]"], "brl");
  assert.equal(p["line_items[1][price_data][unit_amount]"], "250000");
  assert.equal(p["line_items[1][quantity]"], "1");
  assert.match(p["line_items[1][price_data][product_data][name]"], /Implantação — Lolze Growth/);
});

test("carência vira trial real (só a mensalidade é adiada)", () => {
  const p = montarParamsCheckout({ ...base, trialDays: 30 });
  assert.equal(p["subscription_data[trial_period_days]"], "30");
  // o recorrente continua presente (só o cobra é adiado)
  assert.equal(p["line_items[0][price]"], "price_mensal");
});

test("oferta principal do dossiê: R$2.500 setup + R$997/mês + 30 dias", () => {
  const p = montarParamsCheckout({ ...base, setupCents: 250000, trialDays: 30, nomePlano: "Growth" });
  assert.equal(p["line_items[1][price_data][unit_amount]"], "250000");
  assert.equal(p["subscription_data[trial_period_days]"], "30");
});

test("setup/trial zerados NÃO adicionam item nem trial (re-assinatura)", () => {
  const p = montarParamsCheckout({ ...base, setupCents: 0, trialDays: 0 });
  assert.equal(p["line_items[1][price_data][unit_amount]"], undefined);
  assert.equal(p["subscription_data[trial_period_days]"], undefined);
});

test("valores fracionários são arredondados (Stripe exige inteiro em centavos)", () => {
  const p = montarParamsCheckout({ ...base, setupCents: 250000.6, trialDays: 30.4 });
  assert.equal(p["line_items[1][price_data][unit_amount]"], "250001");
  assert.equal(p["subscription_data[trial_period_days]"], "30");
});

test("usa customer quando existe; senão cai para customer_email", () => {
  const comCustomer = montarParamsCheckout({ ...base, customerId: "cus_1", email: "a@b.com" });
  assert.equal(comCustomer["customer"], "cus_1");
  assert.equal(comCustomer["customer_email"], undefined);
  const semCustomer = montarParamsCheckout({ ...base, email: "a@b.com" });
  assert.equal(semCustomer["customer_email"], "a@b.com");
  assert.equal(semCustomer["customer"], undefined);
});
