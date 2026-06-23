"use server";

import { getCrmServer } from "@/lib/supabase/server";
import { getSessao } from "@/lib/supabase/tenant";
import { criarCheckout, criarPortal } from "@/lib/stripe/client";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Inicia o checkout de assinatura do plano do tenant. Devolve a URL do Stripe. */
export async function assinarPlano(): Promise<{ url?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { erro: "Sem permissão." };
  const sb = getCrmServer();
  const { data: t } = await sb
    .from("app_tenants")
    .select("plano,contato_email,stripe_customer_id")
    .eq("id", s.tenantId)
    .maybeSingle();
  if (!t) return { erro: "Empresa não encontrada." };
  const { data: plano } = await sb
    .from("app_plans")
    .select("stripe_price_id")
    .eq("id", t.plano)
    .maybeSingle();
  if (!plano?.stripe_price_id) return { erro: "Plano sem preço configurado no Stripe." };
  const url = await criarCheckout({
    tenantId: s.tenantId,
    priceId: plano.stripe_price_id,
    email: t.contato_email ?? undefined,
    customerId: t.stripe_customer_id ?? undefined,
  });
  return url ? { url } : { erro: "Não foi possível iniciar o pagamento." };
}

/** Abre o Portal do Cliente do Stripe (gerenciar/cancelar). Devolve a URL. */
export async function gerenciarAssinatura(): Promise<{ url?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { erro: "Sem permissão." };
  const sb = getCrmServer();
  const { data: t } = await sb
    .from("app_tenants")
    .select("stripe_customer_id")
    .eq("id", s.tenantId)
    .maybeSingle();
  if (!t?.stripe_customer_id) return { erro: "Sem assinatura ativa." };
  const url = await criarPortal(t.stripe_customer_id);
  return url ? { url } : { erro: "Não foi possível abrir o portal." };
}
