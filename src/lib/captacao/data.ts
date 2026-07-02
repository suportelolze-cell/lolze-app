import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";

export type ProspectRow = {
  id: number;
  nome_empresa: string | null;
  telefone: string;
  site: string | null;
  nicho: string | null;
  cidade: string | null;
  status: string;
  mensagem: string | null;
  enviado_at: string | null;
  created_at: string;
};

export type CaptacaoCfg = {
  instancia: string;
  porDia: number;
  ativo: boolean;
  /** Pool de números liberados pelo admin (o cliente escolhe um). */
  instancias: string[];
};
export type CaptacaoResumo = {
  total: number;
  novo: number;
  enviado: number;
  respondeu: number;
  descartado: number;
  erro: number;
};

export async function getCaptacaoCfg(): Promise<CaptacaoCfg> {
  const tid = await getTenantId();
  if (!tid) return { instancia: "", porDia: 10, ativo: false, instancias: [] };
  const sb = getCrmAdmin();
  const { data } = await sb
    .from("app_config")
    .select("prospect_instancia,prospect_dia,prospect_ativo,prospect_instancias")
    .eq("tenant_id", tid)
    .maybeSingle();
  const pool = Array.isArray(data?.prospect_instancias)
    ? (data!.prospect_instancias as string[]).map(String)
    : [];
  return {
    instancia: (data?.prospect_instancia as string | null) ?? "",
    porDia: Number(data?.prospect_dia ?? 10),
    ativo: Boolean(data?.prospect_ativo ?? false),
    instancias: pool,
  };
}

export async function getProspectsResumo(): Promise<CaptacaoResumo> {
  const vazio = { total: 0, novo: 0, enviado: 0, respondeu: 0, descartado: 0, erro: 0 };
  const tid = await getTenantId();
  if (!tid) return vazio;
  const sb = getCrmAdmin();
  const { data } = await sb.from("app_prospects").select("status").eq("tenant_id", tid);
  const linhas = (data ?? []) as { status: string }[];
  const r = { ...vazio, total: linhas.length };
  for (const l of linhas) {
    if (l.status in r) (r as unknown as Record<string, number>)[l.status] += 1;
  }
  return r;
}

/** Pool de números de captação do tenant + limite do plano (= sdr_max). */
export async function getNumerosCaptacaoInfo(): Promise<{ instancias: string[]; max: number }> {
  const tid = await getTenantId();
  if (!tid) return { instancias: [], max: 0 };
  const sb = getCrmAdmin();
  const { data: cfg } = await sb
    .from("app_config")
    .select("prospect_instancias")
    .eq("tenant_id", tid)
    .maybeSingle();
  const pool = Array.isArray(cfg?.prospect_instancias) ? (cfg!.prospect_instancias as string[]).map(String) : [];
  const { data: t } = await sb.from("app_tenants").select("plano").eq("id", tid).maybeSingle();
  const { data: p } = await sb
    .from("app_plans")
    .select("sdr_max")
    .eq("id", (t?.plano as string) ?? "")
    .maybeSingle();
  return { instancias: pool, max: Number(p?.sdr_max ?? 0) };
}

export async function listarProspects(limit = 200): Promise<ProspectRow[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmAdmin();
  const { data } = await sb
    .from("app_prospects")
    .select("id,nome_empresa,telefone,site,nicho,cidade,status,mensagem,enviado_at,created_at")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ProspectRow[];
}
