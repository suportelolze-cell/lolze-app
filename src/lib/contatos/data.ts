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
  /** Última interação (updated_at, tocado a cada mensagem). Base do filtro "faz tempo que não fala". */
  ultimoContato: string;
  /** Compras aprovadas deste contato (segmento "comprou"). 0 se não comprou. */
  compras: number;
  /** Soma das compras aprovadas, em centavos. */
  totalCompradoCents: number;
};

/** Lista de contatos (leads) do tenant, enriquecidos com as compras (app_vendas). */
export async function getContatos(limit = 2000): Promise<Contato[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmAdmin();

  const { data } = await sb
    .from("app_leads")
    .select("id,nome,telefone,email,canal,origem,temperatura,coluna,valor,created_at,updated_at")
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
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
    updated_at: string | null;
  }>;

  // Compras aprovadas por lead. TOLERANTE à tabela ausente: se a migração de
  // checkout ainda não foi aplicada, o select falha e a gente segue sem clientes
  // (a tela não pode quebrar por causa disso).
  const compras = new Map<number, { compras: number; totalCents: number }>();
  const vendas = await sb
    .from("app_vendas")
    .select("lead_id,valor_cents")
    .eq("tenant_id", tid)
    .eq("evento", "compra_aprovada")
    .not("lead_id", "is", null)
    .limit(10000);
  if (!vendas.error && vendas.data) {
    for (const v of vendas.data as { lead_id: number | null; valor_cents: number | null }[]) {
      if (v.lead_id == null) continue;
      const cur = compras.get(v.lead_id) ?? { compras: 0, totalCents: 0 };
      cur.compras += 1;
      cur.totalCents += v.valor_cents ?? 0;
      compras.set(v.lead_id, cur);
    }
  }

  return linhas.map((r) => {
    const cp = compras.get(r.id);
    return {
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
      ultimoContato: r.updated_at ?? r.created_at,
      compras: cp?.compras ?? 0,
      totalCompradoCents: cp?.totalCents ?? 0,
    };
  });
}
