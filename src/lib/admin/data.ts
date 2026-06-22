import { getCrmServer } from "@/lib/supabase/server";
import { getSessao } from "@/lib/supabase/tenant";

export type Plano = {
  id: string;
  nome: string;
  ordem: number;
  setupCents: number;
  mensalCents: number;
  canaisMax: number;
  carenciaDias: number;
  recursos: string[];
};

export type Cliente = {
  id: string;
  nome: string;
  slug: string | null;
  plano: string;
  status: string;
  canais: string[];
  contatoEmail: string | null;
  contatoTelefone: string | null;
  ativadoEm: string;
  observacoes: string | null;
  leads: number;
  usuarios: number;
};

/** Garante que quem chama é superadmin. Lança se não for. */
export async function exigirSuperadmin() {
  const s = await getSessao();
  if (s.papel !== "superadmin") {
    throw new Error("Acesso restrito ao administrador.");
  }
  return s;
}

export async function getPlanos(): Promise<Plano[]> {
  const sb = getCrmServer();
  const { data } = await sb.from("app_plans").select("*").order("ordem");
  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    ordem: p.ordem,
    setupCents: p.setup_cents,
    mensalCents: p.mensal_cents,
    canaisMax: p.canais_max,
    carenciaDias: p.carencia_dias,
    recursos: (p.recursos as string[]) ?? [],
  }));
}

export async function listarClientes(): Promise<Cliente[]> {
  const sb = getCrmServer();
  const [{ data: tenants }, { data: leads }, { data: profs }] = await Promise.all([
    sb.from("app_tenants").select("*").order("created_at"),
    sb.from("app_leads").select("tenant_id"),
    sb.from("app_profiles").select("tenant_id"),
  ]);

  const contaLeads = new Map<string, number>();
  (leads ?? []).forEach((l) => contaLeads.set(l.tenant_id, (contaLeads.get(l.tenant_id) ?? 0) + 1));
  const contaUsers = new Map<string, number>();
  (profs ?? []).forEach((p) => {
    if (p.tenant_id) contaUsers.set(p.tenant_id, (contaUsers.get(p.tenant_id) ?? 0) + 1);
  });

  return (tenants ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    slug: t.slug,
    plano: t.plano,
    status: t.status,
    canais: (t.canais as string[]) ?? [],
    contatoEmail: t.contato_email,
    contatoTelefone: t.contato_telefone,
    ativadoEm: t.ativado_em,
    observacoes: t.observacoes,
    leads: contaLeads.get(t.id) ?? 0,
    usuarios: contaUsers.get(t.id) ?? 0,
  }));
}

export async function getCliente(id: string): Promise<Cliente | null> {
  const sb = getCrmServer();
  const { data: t } = await sb.from("app_tenants").select("*").eq("id", id).maybeSingle();
  if (!t) return null;

  const [{ count: leads }, { count: usuarios }] = await Promise.all([
    sb.from("app_leads").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    sb.from("app_profiles").select("id", { count: "exact", head: true }).eq("tenant_id", id),
  ]);

  return {
    id: t.id,
    nome: t.nome,
    slug: t.slug,
    plano: t.plano,
    status: t.status,
    canais: (t.canais as string[]) ?? [],
    contatoEmail: t.contato_email,
    contatoTelefone: t.contato_telefone,
    ativadoEm: t.ativado_em,
    observacoes: t.observacoes,
    leads: leads ?? 0,
    usuarios: usuarios ?? 0,
  };
}

export type MetaAdsCfg = { adAccountId: string; tokenSet: boolean };

/** Conexão Meta Ads do cliente. Não devolve o token (só se está setado). */
export async function getMetaAdsCfg(tenantId: string): Promise<MetaAdsCfg> {
  await exigirSuperadmin();
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_tenant_secrets")
    .select("meta_ad_account_id,meta_access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    adAccountId: data?.meta_ad_account_id ?? "",
    tokenSet: Boolean(data?.meta_access_token),
  };
}

export type EvolutionCfg = { instance: string };

/** Nome da instância Evolution do cliente (normalmente criado pelo app). */
export async function getEvolutionCfg(tenantId: string): Promise<EvolutionCfg> {
  await exigirSuperadmin();
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_tenant_secrets")
    .select("evolution_instance")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return { instance: data?.evolution_instance ?? "" };
}

export type Persona = {
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
  agenteAtivo: boolean;
};

/** Persona/cérebro do SDR de um cliente (gerenciado só pelo admin). */
export async function getPersona(tenantId: string): Promise<Persona> {
  await exigirSuperadmin();
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_config")
    .select("oferta,publico,tom,objecoes,faq,regras,agente_ativo")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    oferta: data?.oferta ?? "",
    publico: data?.publico ?? "",
    tom: data?.tom ?? "",
    objecoes: data?.objecoes ?? "",
    faq: data?.faq ?? "",
    regras: data?.regras ?? "",
    agenteAtivo: data?.agente_ativo ?? true,
  };
}
