import { getCrmAdmin } from "@/lib/supabase/admin";
import { custoBRLCents, type UsoTokens } from "./custo";

/**
 * Trava de custo de IA POR PLANO (protege contra gasto descontrolado).
 * Compara o gasto de IA do MÊS do tenant com o teto do plano
 * (app_plans.teto_ia_cents, em centavos de BRL). 0 = ilimitado.
 *
 * Fail-open: se não der pra checar, LIBERA (nunca bloqueia um cliente pagante
 * por causa de um erro de leitura).
 */
export async function dentroDoLimiteIA(tenantId: string): Promise<boolean> {
  if (!tenantId) return true;
  try {
    const admin = getCrmAdmin();

    // Teto do plano do tenant.
    const { data: t } = await admin.from("app_tenants").select("plano").eq("id", tenantId).maybeSingle();
    const { data: p } = await admin
      .from("app_plans")
      .select("teto_ia_cents")
      .eq("id", (t?.plano as string) ?? "")
      .maybeSingle();
    const teto = Number(p?.teto_ia_cents ?? 0);
    if (teto <= 0) return true; // 0 = ilimitado → nem consulta o uso

    // Gasto de IA do mês corrente.
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    const dia1 = inicioMes.toISOString().slice(0, 10);
    const { data } = await admin
      .from("app_uso_ia")
      .select("input_tokens,output_tokens,cache_creation,cache_read")
      .eq("tenant_id", tenantId)
      .gte("dia", dia1);

    const soma = ((data ?? []) as Array<Record<string, number | null>>).reduce<UsoTokens>(
      (acc, r) => ({
        inputTokens: acc.inputTokens + Number(r.input_tokens ?? 0),
        outputTokens: acc.outputTokens + Number(r.output_tokens ?? 0),
        cacheCreation: acc.cacheCreation + Number(r.cache_creation ?? 0),
        cacheRead: acc.cacheRead + Number(r.cache_read ?? 0),
      }),
      { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 }
    );

    return custoBRLCents(soma) < teto;
  } catch {
    return true; // fail-open
  }
}
