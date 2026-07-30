import { getCrmAdmin } from "@/lib/supabase/admin";
import { embedTextos } from "./embed";

// Cache em memória do embedding da CONSULTA (determinístico por texto): evita
// refazer o fetch à OpenAI para consultas repetidas/parecidas dentro do loop de
// tool-use e entre turnos. Sem TTL (o vetor não muda para o mesmo texto+modelo);
// LRU simples por ordem de inserção.
const _cacheEmbed = new Map<string, number[]>();
const CACHE_MAX = 500;

async function embedConsulta(q: string): Promise<number[]> {
  const chave = q.trim().toLowerCase();
  const cache = _cacheEmbed.get(chave);
  if (cache) return cache;
  const [vec] = await embedTextos([q]);
  if (_cacheEmbed.size >= CACHE_MAX) {
    const maisAntigo = _cacheEmbed.keys().next().value;
    if (maisAntigo !== undefined) _cacheEmbed.delete(maisAntigo);
  }
  _cacheEmbed.set(chave, vec);
  return vec;
}

/**
 * Busca na base de conhecimento do cliente (RAG). Embedda a consulta, faz a
 * busca por similaridade filtrada pelo tenant e devolve os trechos mais
 * relevantes como texto para a IA usar. SERVER-ONLY.
 */
export async function buscarConhecimento(
  tenantId: string,
  consulta: string,
  k = 5
): Promise<string> {
  const q = (consulta || "").trim();
  if (!q) return "Consulta vazia.";

  const vec = await embedConsulta(q);
  const admin = getCrmAdmin();
  const { data, error } = await admin.rpc("match_app_kb", {
    query_embedding: "[" + vec.join(",") + "]",
    match_count: k,
    filter: { tenant_id: tenantId },
  });
  if (error) return "Erro ao consultar a base de conhecimento: " + error.message;

  const rows = (data ?? []) as { content: string; similarity: number }[];
  const uteis = rows.filter((r) => r.similarity > 0.2);
  if (uteis.length === 0) return "Nada encontrado na documentação da empresa sobre isso.";

  return uteis.map((r, i) => `[Trecho ${i + 1}]\n${r.content}`).join("\n\n");
}
