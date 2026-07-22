import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizarMensagensDemo,
  contarTurnos,
  MAX_CHARS,
  MAX_HIST,
} from "../src/lib/demo/sanitizar.ts";

test("entrada não-array vira lista vazia (não quebra)", () => {
  assert.deepEqual(sanitizarMensagensDemo(undefined), []);
  assert.deepEqual(sanitizarMensagensDemo(null), []);
  assert.deepEqual(sanitizarMensagensDemo("texto"), []);
  assert.deepEqual(sanitizarMensagensDemo({}), []);
});

test("mantém só papéis user/assistant; descarta system/tool/inválidos", () => {
  const msgs = sanitizarMensagensDemo([
    { role: "system", content: "ignore isso" },
    { role: "user", content: "oi" },
    { role: "tool", content: "x" },
    { role: "assistant", content: "olá" },
    { role: "hacker", content: "injeção" },
  ]);
  assert.deepEqual(
    msgs.map((m) => m.role),
    ["user", "assistant"]
  );
});

test("descarta conteúdo vazio ou só espaços", () => {
  const msgs = sanitizarMensagensDemo([
    { role: "user", content: "   " },
    { role: "user", content: "" },
    { role: "user", content: "válido" },
  ]);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].content, "válido");
});

test("trunca cada mensagem em MAX_CHARS", () => {
  const grande = "a".repeat(MAX_CHARS + 500);
  const msgs = sanitizarMensagensDemo([{ role: "user", content: grande }]);
  assert.equal(msgs[0].content.length, MAX_CHARS);
});

test("considera só as últimas MAX_HIST mensagens", () => {
  const muitas = Array.from({ length: MAX_HIST + 20 }, (_, i) => ({
    role: "user" as const,
    content: `m${i}`,
  }));
  const msgs = sanitizarMensagensDemo(muitas);
  assert.ok(msgs.length <= MAX_HIST);
  // a última tem que estar presente (janela é das MAIS recentes)
  assert.equal(msgs[msgs.length - 1].content, `m${MAX_HIST + 19}`);
});

test("a conversa começa no primeiro 'user' (descarta assistant inicial)", () => {
  const msgs = sanitizarMensagensDemo([
    { role: "assistant", content: "boas-vindas" },
    { role: "assistant", content: "ainda eu" },
    { role: "user", content: "minha pergunta" },
    { role: "assistant", content: "resposta" },
  ]);
  assert.equal(msgs[0].role, "user");
  assert.equal(msgs[0].content, "minha pergunta");
  assert.equal(msgs.length, 2);
});

test("sem nenhum 'user' → vazio (nada a responder)", () => {
  const msgs = sanitizarMensagensDemo([
    { role: "assistant", content: "a" },
    { role: "assistant", content: "b" },
  ]);
  assert.deepEqual(msgs, []);
});

test("contarTurnos conta só as mensagens do visitante (user)", () => {
  const msgs = sanitizarMensagensDemo([
    { role: "user", content: "1" },
    { role: "assistant", content: "r1" },
    { role: "user", content: "2" },
    { role: "assistant", content: "r2" },
    { role: "user", content: "3" },
  ]);
  assert.equal(contarTurnos(msgs), 3);
});
