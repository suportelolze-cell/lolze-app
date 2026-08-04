import { test } from "node:test";
import assert from "node:assert/strict";
import { colunaAusente } from "../src/lib/supabase/pg-erros.ts";

test("colunaAusente: código 42703 (SELECT) e PGRST204 (write)", () => {
  assert.equal(colunaAusente({ code: "42703" }), true);
  assert.equal(colunaAusente({ code: "PGRST204" }), true);
});

test("colunaAusente: mensagem 'does not exist' / 'schema cache'", () => {
  assert.equal(colunaAusente({ message: "column app_config.regua_qualificacao does not exist" }), true);
  assert.equal(
    colunaAusente({ message: "Could not find the 'regua_qualificacao' column ... in the schema cache" }),
    true
  );
});

test("colunaAusente: outros erros / vazio -> false", () => {
  assert.equal(colunaAusente({ code: "PGRST301", message: "jwt expired" }), false);
  assert.equal(colunaAusente({ code: "23505", message: "duplicate key" }), false);
  assert.equal(colunaAusente(null), false);
  assert.equal(colunaAusente(undefined), false);
});
