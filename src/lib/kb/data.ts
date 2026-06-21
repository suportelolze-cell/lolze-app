import { getCrmServer } from "@/lib/supabase/server";

export type KbFile = { fileNome: string; trechos: number; criadoEm: string };

/** Documentos da base de conhecimento de um cliente, agrupados por arquivo. */
export async function listarDocs(tenantId: string): Promise<KbFile[]> {
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_kb_documents")
    .select("file_nome,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const map = new Map<string, KbFile>();
  (data ?? []).forEach((r) => {
    const e = map.get(r.file_nome) ?? { fileNome: r.file_nome, trechos: 0, criadoEm: r.created_at };
    e.trechos += 1;
    if (r.created_at > e.criadoEm) e.criadoEm = r.created_at;
    map.set(r.file_nome, e);
  });
  return Array.from(map.values());
}
