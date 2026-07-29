import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import type { MidiaTipo } from "@/lib/atendimento/midia-core";

export type ItemBiblioteca = {
  id: string;
  nome: string;
  quandoUsar: string;
  tipo: MidiaTipo;
  filename: string | null;
  ativo: boolean;
};

/** Lista a biblioteca do tenant da sessão (para a UI de gestão). */
export async function listarBiblioteca(): Promise<ItemBiblioteca[]> {
  const s = await getSessao();
  if (!s.tenantId) return [];
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_biblioteca_midia")
    .select("id,nome,quando_usar,tipo,filename,ativo")
    .eq("tenant_id", s.tenantId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    nome: String(r.nome ?? ""),
    quandoUsar: String(r.quando_usar ?? ""),
    tipo: r.tipo as MidiaTipo,
    filename: (r.filename as string | null) ?? null,
    ativo: Boolean(r.ativo),
  }));
}
