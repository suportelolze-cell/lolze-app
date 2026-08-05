import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Allowlist de operador (server): o número do prestador/operador do tenant
 * (app_config.especialista_numero). Mensagem vinda DELE para o número do negócio
 * não é lead de venda — os webhooks a ignoram. "" quando não configurado (o
 * allowlist fica inerte, sem barrar nenhum lead).
 */
export async function numeroOperadorDoTenant(
  admin: ReturnType<typeof getCrmAdmin>,
  tenantId: string
): Promise<string> {
  const { data } = await admin
    .from("app_config")
    .select("especialista_numero")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return ((data?.especialista_numero as string | null) ?? "").trim();
}
