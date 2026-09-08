import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Rate limit compartilhado via banco (robusto no serverless, ao contrário de
 * memória por instância). Retorna true se DENTRO do limite (pode prosseguir) e
 * registra o hit. Fail-open em qualquer erro.
 *
 * Fica separado de antiabuso.ts DE PROPÓSITO: antiabuso importa next/headers
 * (só server request), e este módulo é usado também por código que entra no
 * grafo de Client Component (ex.: followup via card de teste do admin), onde
 * next/headers quebra o build. Aqui só depende do service-role.
 *
 * `ip` é só a CHAVE do balde — pode ser um IP, um tenantId, etc.
 */
export async function dentroDoLimite(
  bucket: string,
  ip: string,
  max: number,
  janelaSeg: number
): Promise<boolean> {
  if (!ip || ip === "desconhecido") return true;
  try {
    const admin = getCrmAdmin();
    const desde = new Date(Date.now() - janelaSeg * 1000).toISOString();
    const { count } = await admin
      .from("app_rate_hits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("ip", ip)
      .gte("created_at", desde);
    if ((count ?? 0) >= max) return false;

    await admin.from("app_rate_hits").insert({ bucket, ip });

    // Limpeza oportunista (mantém a tabela enxuta sem cron dedicado).
    if (Math.random() < 0.05) {
      const velho = new Date(Date.now() - 86400 * 1000).toISOString();
      await admin.from("app_rate_hits").delete().lt("created_at", velho);
    }
    return true;
  } catch {
    return true; // fail-open
  }
}
