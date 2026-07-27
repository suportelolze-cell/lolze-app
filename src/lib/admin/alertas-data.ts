import { getCrmAdmin } from "@/lib/supabase/admin";
import { exigirSuperadmin } from "./data";
import { classificarAlertas, type SinalTenant, type ResumoAlertas } from "./alertas-core";
import { custoBRLCents, type UsoTokens } from "@/lib/agent/custo";

/**
 * Central de alertas do superadmin (dossiê §10). Lê o ESTADO de cada tenant
 * (não espera exceção) e devolve os alertas classificados. Só superadmin.
 */

export type { Alerta, ResumoAlertas } from "./alertas-core";

const ZERO: UsoTokens = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };

export async function getAlertas(): Promise<ResumoAlertas> {
  await exigirSuperadmin();
  const admin = getCrmAdmin();

  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  const dia1 = inicioMes.toISOString().slice(0, 10);
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: tenants },
    { data: configs },
    { data: secrets },
    { data: plans },
    { data: uso },
    { data: erros },
    { data: mortas },
  ] = await Promise.all([
    admin.from("app_tenants").select("id,nome,plano,status").neq("status", "cancelado"),
    admin.from("app_config").select("tenant_id,agente_ativo,whatsapp_conectado"),
    admin
      .from("app_tenant_secrets")
      .select("tenant_id,evolution_instance,wa_phone_number_id,wa_access_token,ig_account_id,ig_access_token"),
    admin.from("app_plans").select("id,teto_ia_cents"),
    admin
      .from("app_uso_ia")
      .select("tenant_id,input_tokens,output_tokens,cache_creation,cache_read")
      .gte("dia", dia1),
    admin.from("app_erros").select("tenant_id").eq("severidade", "alta").gte("created_at", desde24h),
    admin.from("app_mensagens").select("tenant_id").eq("status", "morta"),
  ]);

  const cfgPor = new Map((configs ?? []).map((c: Record<string, unknown>) => [String(c.tenant_id), c]));
  const secPor = new Map((secrets ?? []).map((s: Record<string, unknown>) => [String(s.tenant_id), s]));
  const tetoPor = new Map(
    ((plans as { id: string; teto_ia_cents: number }[] | null) ?? []).map((p) => [p.id, Number(p.teto_ia_cents ?? 0)])
  );

  const usoPor = new Map<string, UsoTokens>();
  for (const u of (uso as Record<string, number | string | null>[] | null) ?? []) {
    const tid = String(u.tenant_id);
    const cur = usoPor.get(tid) ?? { ...ZERO };
    cur.inputTokens += Number(u.input_tokens ?? 0);
    cur.outputTokens += Number(u.output_tokens ?? 0);
    cur.cacheCreation += Number(u.cache_creation ?? 0);
    cur.cacheRead += Number(u.cache_read ?? 0);
    usoPor.set(tid, cur);
  }

  const contar = (rows: Record<string, unknown>[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const tid = String(r.tenant_id);
      m.set(tid, (m.get(tid) ?? 0) + 1);
    }
    return m;
  };
  const errosPor = contar(erros as Record<string, unknown>[] | null);
  const mortasPor = contar(mortas as Record<string, unknown>[] | null);

  const sinais: SinalTenant[] = (
    (tenants as { id: string; nome: string; plano: string; status: string }[] | null) ?? []
  ).map((t) => {
    const cfg = cfgPor.get(t.id) ?? {};
    const sec = secPor.get(t.id) ?? {};
    const whatsappConectado =
      Boolean((cfg as { whatsapp_conectado?: boolean }).whatsapp_conectado) ||
      Boolean((sec as { wa_phone_number_id?: string; wa_access_token?: string }).wa_phone_number_id &&
        (sec as { wa_access_token?: string }).wa_access_token) ||
      Boolean((sec as { evolution_instance?: string }).evolution_instance);
    const instagramConfigurado = Boolean(
      (sec as { ig_account_id?: string }).ig_account_id || (sec as { ig_access_token?: string }).ig_access_token
    );
    return {
      tenantId: t.id,
      nome: t.nome,
      agenteAtivo: Boolean((cfg as { agente_ativo?: boolean }).agente_ativo ?? true),
      whatsappConectado,
      instagramConfigurado,
      errosAltos24h: errosPor.get(t.id) ?? 0,
      deadLetters: mortasPor.get(t.id) ?? 0,
      custoCents: custoBRLCents(usoPor.get(t.id) ?? ZERO),
      tetoCents: tetoPor.get(t.plano) ?? 0,
    };
  });

  return classificarAlertas(sinais);
}
