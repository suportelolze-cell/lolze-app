import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";

export type Contato = {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  canal: string;
  origem: string;
  temperatura: string;
  coluna: string;
  valor: number | null;
  createdAt: string;
};

/** Lista de contatos (leads) do tenant, de todos os canais. */
export async function getContatos(limit = 2000): Promise<Contato[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmAdmin();
  const { data } = await sb
    .from("app_leads")
    .select("id,nome,telefone,email,canal,origem,temperatura,coluna,valor,created_at")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(limit);

  const linhas = (data ?? []) as Array<{
    id: number;
    nome: string | null;
    telefone: string | null;
    email: string | null;
    canal: string | null;
    origem: string | null;
    temperatura: string | null;
    coluna: string | null;
    valor: number | null;
    created_at: string;
  }>;
  return linhas.map((r) => ({
    id: r.id,
    nome: r.nome ?? "",
    telefone: r.telefone ?? "",
    email: r.email ?? "",
    canal: r.canal ?? "",
    origem: r.origem ?? "",
    temperatura: r.temperatura ?? "",
    coluna: r.coluna ?? "",
    valor: r.valor,
    createdAt: r.created_at,
  }));
}
