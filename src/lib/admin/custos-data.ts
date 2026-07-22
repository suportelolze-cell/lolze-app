import { getCrmAdmin } from "@/lib/supabase/admin";
import { exigirSuperadmin } from "./data";
import { resumirCustos, type LinhaCusto, type ResumoCustos } from "./custos-core";
import { custoBRLCents, type UsoTokens } from "@/lib/agent/custo";

/**
 * Painel de custo/margem por tenant (dossiê §12 + §10 "custo de IA por tenant").
 * Só superadmin. Lê o uso de IA do MÊS corrente (mesma janela da trava de custo)
 * e cruza com a mensalidade do plano. A matemática vive em custos-core.ts.
 */

export type { ResumoCustos, TenantCusto } from "./custos-core";

const ZERO: UsoTokens = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };

export async function getCustos(): Promise<ResumoCustos> {
  await exigirSuperadmin();
  const admin = getCrmAdmin();

  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  const dia1 = inicioMes.toISOString().slice(0, 10);

  const [{ data: tenants }, { data: plans }, { data: uso }] = await Promise.all([
    admin.from("app_tenants").select("id,nome,plano,status"),
    admin.from("app_plans").select("id,mensal_cents"),
    admin
      .from("app_uso_ia")
      .select("tenant_id,input_tokens,output_tokens,cache_creation,cache_read,chamadas")
      .gte("dia", dia1),
  ]);

  // Agrega tokens + chamadas por tenant no mês.
  const porTenant = new Map<string, { uso: UsoTokens; chamadas: number }>();
  for (const u of (uso as Record<string, number | string | null>[] | null) ?? []) {
    const tid = String(u.tenant_id);
    const cur = porTenant.get(tid) ?? { uso: { ...ZERO }, chamadas: 0 };
    cur.uso.inputTokens += Number(u.input_tokens ?? 0);
    cur.uso.outputTokens += Number(u.output_tokens ?? 0);
    cur.uso.cacheCreation += Number(u.cache_creation ?? 0);
    cur.uso.cacheRead += Number(u.cache_read ?? 0);
    cur.chamadas += Number(u.chamadas ?? 0);
    porTenant.set(tid, cur);
  }

  const mensalPorPlano = new Map(
    ((plans as { id: string; mensal_cents: number }[] | null) ?? []).map((p) => [p.id, Number(p.mensal_cents ?? 0)])
  );

  const rows: LinhaCusto[] = ((tenants as { id: string; nome: string; plano: string; status: string }[] | null) ?? []).map(
    (t) => {
      const agg = porTenant.get(t.id) ?? { uso: { ...ZERO }, chamadas: 0 };
      return {
        tenantId: t.id,
        nome: t.nome,
        plano: t.plano,
        status: t.status,
        mensalCents: mensalPorPlano.get(t.plano) ?? 0,
        custoCents: custoBRLCents(agg.uso),
        chamadas: agg.chamadas,
      };
    }
  );

  return resumirCustos(rows);
}
