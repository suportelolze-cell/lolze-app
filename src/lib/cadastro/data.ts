import { getCrmAdmin } from "@/lib/supabase/admin";

export type PlanoPublico = {
  id: string;
  nome: string;
  mensalCents: number;
  setupCents: number;
  recursos: string[];
  temPreco: boolean; // tem stripe_price_id configurado
};

/** Planos disponíveis para o cadastro público (leitura server-side). */
export async function getPlanosPublicos(): Promise<PlanoPublico[]> {
  try {
    const sb = getCrmAdmin();
    const { data } = await sb
      .from("app_plans")
      .select("id,nome,ordem,mensal_cents,setup_cents,recursos,stripe_price_id")
      .order("ordem");
    return (data ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      mensalCents: Number(p.mensal_cents ?? 0),
      setupCents: Number(p.setup_cents ?? 0),
      recursos: (p.recursos as string[]) ?? [],
      temPreco: Boolean(p.stripe_price_id),
    }));
  } catch {
    return [];
  }
}
