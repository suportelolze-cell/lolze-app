import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";

export type Venda = {
  id: string;
  plataforma: string;
  evento: string;
  produto: string;
  oferta: string;
  valorCents: number;
  metodo: string;
  comprador: string;
  criadoEm: string;
};

export type VendasResumo = {
  faturadoCents: number; // soma das compras aprovadas
  aprovadas: number;
  pendentes: number; // pix/boleto gerado, ainda não pago
  abandonados: number; // carrinho abandonado
  reembolsos: number; // reembolso + chargeback
};

export type VendasDados = {
  vendas: Venda[];
  resumo: VendasResumo;
  /** true se a tabela de vendas ainda não existe (checkout não ativado). */
  migracaoPendente: boolean;
};

const RESUMO_ZERO: VendasResumo = {
  faturadoCents: 0,
  aprovadas: 0,
  pendentes: 0,
  abandonados: 0,
  reembolsos: 0,
};

/** Vendas do tenant (todas as plataformas). Tolerante à tabela ausente. */
export async function getVendas(limit = 500): Promise<VendasDados> {
  const tid = await getTenantId();
  if (!tid) return { vendas: [], resumo: { ...RESUMO_ZERO }, migracaoPendente: false };

  const sb = getCrmAdmin();
  const { data, error } = await sb
    .from("app_vendas")
    .select(
      "id,plataforma,evento,produto_nome,oferta,valor_cents,metodo_pagamento,comprador_nome,comprador_email,criado_em"
    )
    .eq("tenant_id", tid)
    .order("criado_em", { ascending: false })
    .limit(limit);

  // Erro (mais comum: tabela ainda não criada = checkout não ativado) → degrada.
  if (error) return { vendas: [], resumo: { ...RESUMO_ZERO }, migracaoPendente: true };

  const rows = (data ?? []) as Array<{
    id: string | number;
    plataforma: string | null;
    evento: string | null;
    produto_nome: string | null;
    oferta: string | null;
    valor_cents: number | null;
    metodo_pagamento: string | null;
    comprador_nome: string | null;
    comprador_email: string | null;
    criado_em: string;
  }>;

  const vendas: Venda[] = rows.map((r) => ({
    id: String(r.id),
    plataforma: r.plataforma ?? "",
    evento: r.evento ?? "",
    produto: r.produto_nome ?? "",
    oferta: r.oferta ?? "",
    valorCents: Number(r.valor_cents ?? 0),
    metodo: r.metodo_pagamento ?? "",
    comprador: r.comprador_nome || r.comprador_email || "",
    criadoEm: r.criado_em,
  }));

  const resumo: VendasResumo = {
    faturadoCents: rows
      .filter((r) => r.evento === "compra_aprovada")
      .reduce((s, r) => s + Number(r.valor_cents ?? 0), 0),
    aprovadas: rows.filter((r) => r.evento === "compra_aprovada").length,
    pendentes: rows.filter((r) => r.evento === "pix_gerado" || r.evento === "boleto_gerado").length,
    abandonados: rows.filter((r) => r.evento === "checkout_abandonado").length,
    reembolsos: rows.filter((r) => r.evento === "reembolso" || r.evento === "chargeback").length,
  };

  return { vendas, resumo, migracaoPendente: false };
}
