import { getCrmAdmin } from "@/lib/supabase/admin";

export type PlanoPublico = {
  id: string;
  nome: string;
  mensalCents: number;
  setupCents: number; // valor COBRADO da implantação (pode ser o de lançamento)
  setupCentsDe: number; // preço OFICIAL da implantação (riscado); 0 = sem oferta
  sobConsulta: boolean; // Advanced: "a partir de" + falar com a gente
  recursos: string[];
  temPreco: boolean; // tem stripe_price_id configurado
};

/** Planos disponíveis para o cadastro público (leitura server-side). */
export async function getPlanosPublicos(): Promise<PlanoPublico[]> {
  try {
    const sb = getCrmAdmin();
    const { data } = await sb
      .from("app_plans")
      .select("id,nome,ordem,mensal_cents,setup_cents,setup_cents_de,sob_consulta,recursos,stripe_price_id")
      .eq("ativo", true) // só planos ATIVOS aparecem no público (landing/cadastro)
      .order("ordem");
    return (data ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      mensalCents: Number(p.mensal_cents ?? 0),
      setupCents: Number(p.setup_cents ?? 0),
      setupCentsDe: Number(p.setup_cents_de ?? 0),
      sobConsulta: Boolean(p.sob_consulta),
      recursos: (p.recursos as string[]) ?? [],
      temPreco: Boolean(p.stripe_price_id),
    }));
  } catch {
    return [];
  }
}
