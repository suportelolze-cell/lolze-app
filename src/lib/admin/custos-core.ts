/**
 * Núcleo PURO do painel de custo/margem por tenant (dossiê §12: "a decisão de
 * preço deve usar os custos reais registrados por tenant"). Sem I/O e sem
 * dependências — recebe o custo de IA já calculado (custoCents) e cuida só da
 * matemática de margem; a leitura de app_uso_ia e o custo em si ficam em
 * custos-data.ts (que usa @/lib/agent/custo).
 *
 * HONESTIDADE (mandato §4): custoCents é só custo de IA (não inclui suporte/
 * infra), precificado à tarifa do Sonnet (modelo do SDR) — roteador/demo usam
 * Haiku, mais barato, então o número SUPERESTIMA um pouco. Teto conservador.
 */

export type TenantCusto = {
  tenantId: string;
  nome: string;
  plano: string;
  status: string;
  custoCents: number; // custo de IA no mês
  receitaCents: number; // mensalidade do plano
  margemCents: number;
  margemPct: number | null; // null quando não há receita (plano sem preço)
  chamadas: number;
};

export type ResumoCustos = {
  tenants: TenantCusto[];
  totalReceitaCents: number;
  totalCustoCents: number;
  margemGlobalPct: number | null;
};

export type LinhaCusto = {
  tenantId: string;
  nome: string;
  plano: string;
  status: string;
  mensalCents: number;
  custoCents: number; // custo de IA já calculado (ver custos-data.ts)
  chamadas: number;
};

/** Agrega custo de IA, receita e margem por tenant + totais. */
export function resumirCustos(rows: LinhaCusto[]): ResumoCustos {
  const tenants: TenantCusto[] = rows.map((r) => {
    const custoCents = r.custoCents;
    const receitaCents = r.mensalCents;
    const margemCents = receitaCents - custoCents;
    const margemPct =
      receitaCents > 0 ? Math.round((margemCents / receitaCents) * 1000) / 10 : null;
    return {
      tenantId: r.tenantId,
      nome: r.nome,
      plano: r.plano,
      status: r.status,
      custoCents,
      receitaCents,
      margemCents,
      margemPct,
      chamadas: r.chamadas,
    };
  });

  // Piores margens primeiro (é o que exige atenção); sem receita vai pro fim.
  tenants.sort((a, b) => {
    if (a.margemPct == null) return 1;
    if (b.margemPct == null) return -1;
    return a.margemPct - b.margemPct;
  });

  const totalReceitaCents = tenants.reduce((s, t) => s + t.receitaCents, 0);
  const totalCustoCents = tenants.reduce((s, t) => s + t.custoCents, 0);
  const margemGlobalPct =
    totalReceitaCents > 0
      ? Math.round(((totalReceitaCents - totalCustoCents) / totalReceitaCents) * 1000) / 10
      : null;

  return { tenants, totalReceitaCents, totalCustoCents, margemGlobalPct };
}
