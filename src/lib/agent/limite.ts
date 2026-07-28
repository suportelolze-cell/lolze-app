import { getCrmAdmin } from "@/lib/supabase/admin";
import { custoBRLCents, type UsoTokens } from "./custo";

type Admin = ReturnType<typeof getCrmAdmin>;

/** Primeiro dia do mês corrente (UTC) no formato YYYY-MM-DD. */
function inicioDoMes(): string {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

/** Soma o uso de tokens do MÊS corrente de um tenant. */
async function somaUsoMes(admin: Admin, tenantId: string): Promise<UsoTokens> {
  const { data } = await admin
    .from("app_uso_ia")
    .select("input_tokens,output_tokens,cache_creation,cache_read")
    .eq("tenant_id", tenantId)
    .gte("dia", inicioDoMes());

  return ((data ?? []) as Array<Record<string, number | null>>).reduce<UsoTokens>(
    (acc, r) => ({
      inputTokens: acc.inputTokens + Number(r.input_tokens ?? 0),
      outputTokens: acc.outputTokens + Number(r.output_tokens ?? 0),
      cacheCreation: acc.cacheCreation + Number(r.cache_creation ?? 0),
      cacheRead: acc.cacheRead + Number(r.cache_read ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 }
  );
}

/** Teto de IA (centavos de BRL) do plano do tenant. 0 = ilimitado. */
async function tetoDoPlano(admin: Admin, tenantId: string): Promise<number> {
  const { data: t } = await admin.from("app_tenants").select("plano").eq("id", tenantId).maybeSingle();
  const { data: p } = await admin
    .from("app_plans")
    .select("teto_ia_cents")
    .eq("id", (t?.plano as string) ?? "")
    .maybeSingle();
  return Number(p?.teto_ia_cents ?? 0);
}

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
    const teto = await tetoDoPlano(admin, tenantId);
    if (teto <= 0) return true; // 0 = ilimitado → nem consulta o uso
    const soma = await somaUsoMes(admin, tenantId);
    return custoBRLCents(soma) < teto;
  } catch {
    return true; // fail-open
  }
}

export type ResumoIA = {
  usadoCents: number; // custo de IA do mês (centavos de BRL)
  tetoCents: number; // teto do plano (centavos); 0 = ilimitado
};

/**
 * Uso de IA do mês vs teto do plano — para EXIBIR ao cliente (transparência).
 * Diferente da trava, aqui sempre calcula o uso (mesmo com teto ilimitado),
 * para o indicador poder mostrar o consumo. Fail-safe: em erro devolve zeros.
 */
export async function resumoIAMes(tenantId: string): Promise<ResumoIA> {
  if (!tenantId) return { usadoCents: 0, tetoCents: 0 };
  try {
    const admin = getCrmAdmin();
    const [teto, soma] = await Promise.all([
      tetoDoPlano(admin, tenantId),
      somaUsoMes(admin, tenantId),
    ]);
    return { usadoCents: custoBRLCents(soma), tetoCents: teto };
  } catch {
    return { usadoCents: 0, tetoCents: 0 };
  }
}
