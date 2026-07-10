import { getCrmAdmin } from "@/lib/supabase/admin";
import { headers } from "next/headers";

/**
 * Anti-abuso para superfícies PÚBLICAS (cadastro, quiz da landing).
 * Server-only (usa next/headers + service-role). Fail-open: nunca trava
 * um usuário legítimo por erro de infra.
 */

/** IP do cliente a partir dos headers da Vercel. */
export function ipDoCliente(): string {
  try {
    const h = headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return (fwd.split(",")[0].trim() || "desconhecido").slice(0, 60);
    return (h.get("x-real-ip") || "desconhecido").slice(0, 60);
  } catch {
    return "desconhecido";
  }
}

/** Campo isca: bot preenche, humano não vê. true = veio de bot. */
export function honeypot(valor?: string): boolean {
  return (valor ?? "").trim().length > 0;
}

/**
 * Rate limit compartilhado via banco (robusto no serverless, ao contrário de
 * memória por instância). Retorna true se DENTRO do limite (pode prosseguir) e
 * registra o hit. Fail-open em qualquer erro.
 */
export async function dentroDoLimite(
  bucket: string,
  ip: string,
  max: number,
  janelaSeg: number
): Promise<boolean> {
  // Sem IP confiável (raro na Vercel): não conta, pra não bloquear geral.
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
