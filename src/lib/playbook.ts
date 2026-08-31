import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";

export type Playbook = "servico_local" | "infoproduto";

/**
 * Lê o playbook do tenant atual, sem exigir permissão de gestor (leitura para a
 * UI decidir o layout). Tolerante à coluna/tabela ausente: cai no padrão.
 * Para editar o playbook, use as actions gestor-only em agent/playbook-actions.
 */
export async function lerPlaybook(): Promise<Playbook> {
  const tid = await getTenantId();
  if (!tid) return "servico_local";
  const admin = getCrmAdmin();
  const { data, error } = await admin
    .from("app_config")
    .select("playbook")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (error || !data) return "servico_local";
  return (data as { playbook?: unknown }).playbook === "infoproduto" ? "infoproduto" : "servico_local";
}
