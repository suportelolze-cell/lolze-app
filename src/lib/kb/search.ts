import { getCrmAdmin } from "@/lib/supabase/admin";
import { embedTextos } from "./embed";

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

  const [vec] = await embedTextos([q]);
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
