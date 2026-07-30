import { test } from "node:test";
import assert from "node:assert/strict";
import { mesclarPorId } from "../src/lib/atendimento/mensagens-core.ts";

test("mescla e ordena por id, sem duplicar", () => {
  const antigas = [{ id: 1, v: "a" }, { id: 2, v: "b" }, { id: 3, v: "c" }];
  const recentes = [{ id: 3, v: "c2" }, { id: 4, v: "d" }];
  const out = mesclarPorId(antigas, recentes);
  assert.deepEqual(out.map((x) => x.id), [1, 2, 3, 4]);
  // recentes vencem no id repetido (status mais novo)
  assert.equal(out.find((x) => x.id === 3)!.v, "c2");
});

test("listas vazias e desordenadas", () => {
  assert.deepEqual(mesclarPorId([], []), []);
  const out = mesclarPorId([{ id: 5 }], [{ id: 2 }, { id: 9 }, { id: 2 }]);
  assert.deepEqual(out.map((x) => x.id), [2, 5, 9]);
});
