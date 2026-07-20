import { getCrmServer } from "@/lib/supabase/server";
import { getSessao } from "@/lib/supabase/tenant";

export type Membro = { id: string; nome: string; email: string; papel: string };

export type EquipeInfo = {
  membros: Membro[];
  sdrAtivos: number;
  sdrMax: number;
  planoNome: string;
  podeGerenciar: boolean;
  meuId: string;
};

const ehSdr = (papel: string) => papel === "membro" || papel === "sdr";

export async function getEquipeInfo(): Promise<EquipeInfo> {
  const s = await getSessao();
  const vazio: EquipeInfo = {
    membros: [],
    sdrAtivos: 0,
    sdrMax: 0,
    planoNome: "",
    podeGerenciar: false,
    meuId: s.userId ?? "",
  };
  if (!s.tenantId) return vazio;

  const sb = await getCrmServer();
  const [{ data: tenant }, { data: perfis }] = await Promise.all([
    sb.from("app_tenants").select("plano").eq("id", s.tenantId).maybeSingle(),
    sb
      .from("app_profiles")
      .select("id,nome,email,papel")
      .eq("tenant_id", s.tenantId)
      .order("created_at"),
  ]);

  let planoNome = "";
  let sdrMax = 0;
  if (tenant?.plano) {
    const { data: plano } = await sb
      .from("app_plans")
      .select("nome,sdr_max")
      .eq("id", tenant.plano)
      .maybeSingle();
    planoNome = plano?.nome ?? tenant.plano;
    sdrMax = plano?.sdr_max ?? 0;
  }

  const membros: Membro[] = (perfis ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    email: m.email ?? "",
    papel: m.papel,
  }));
  const sdrAtivos = membros.filter((m) => ehSdr(m.papel)).length;

  return {
    membros,
    sdrAtivos,
    sdrMax,
    planoNome,
    podeGerenciar: s.papel === "owner" || s.papel === "superadmin",
    meuId: s.userId ?? "",
  };
}
