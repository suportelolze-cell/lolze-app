import { getCrmAdmin } from "@/lib/supabase/admin";
import type { MidiaTipo } from "@/lib/atendimento/midia-core";

/**
 * Leitura da biblioteca para o AGENTE (service_role, sem sessão). Fica separada
 * de data.ts (que usa getSessao → next/headers) para não arrastar next/headers
 * ao bundle do agente/cliente.
 */
export type ItemBibliotecaAgente = {
  id: string;
  nome: string;
  quandoUsar: string;
  tipo: MidiaTipo;
  path: string;
  mime: string | null;
  filename: string | null;
};

/** Lista os arquivos ATIVOS de um tenant para o agente enviar. */
export async function listarBibliotecaAtiva(tenantId: string): Promise<ItemBibliotecaAgente[]> {
  if (!tenantId) return [];
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_biblioteca_midia")
    .select("id,nome,quando_usar,tipo,path,mime,filename")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    nome: String(r.nome ?? ""),
    quandoUsar: String(r.quando_usar ?? ""),
    tipo: r.tipo as MidiaTipo,
    path: String(r.path ?? ""),
    mime: (r.mime as string | null) ?? null,
    filename: (r.filename as string | null) ?? null,
  }));
}
