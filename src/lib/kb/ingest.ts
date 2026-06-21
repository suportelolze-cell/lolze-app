import { getCrmAdmin } from "@/lib/supabase/admin";
import { embedTextos } from "./embed";

/** Fatia o texto em trechos com sobreposição (melhora a recuperação no RAG). */
export function fatiar(texto: string, tam = 1100, overlap = 150): string[] {
  const limpo = texto
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < limpo.length) {
    chunks.push(limpo.slice(i, i + tam));
    i += tam - overlap;
  }
  return chunks.map((c) => c.trim()).filter((c) => c.length > 20);
}

/**
 * Ingere um documento: fatia, gera embeddings e grava no pgvector (por tenant).
 * Retorna o número de trechos criados.
 */
export async function ingerir(tenantId: string, fileNome: string, texto: string): Promise<number> {
  const chunks = fatiar(texto);
  if (chunks.length === 0) throw new Error("Documento vazio ou muito curto.");

  const admin = getCrmAdmin();

  // Embeddings em lotes (limite e custo).
  const lote = 96;
  const vetores: number[][] = [];
  for (let i = 0; i < chunks.length; i += lote) {
    const v = await embedTextos(chunks.slice(i, i + lote));
    vetores.push(...v);
  }

  const rows = chunks.map((content, idx) => ({
    tenant_id: tenantId,
    file_nome: fileNome,
    content,
    metadata: { tenant_id: tenantId, file: fileNome },
    embedding: "[" + vetores[idx].join(",") + "]",
  }));

  // Insere em lotes.
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("app_kb_documents").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }

  return chunks.length;
}
