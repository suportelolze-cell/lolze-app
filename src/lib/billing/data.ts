import { getCrmServer } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/supabase/tenant";
import { temStripe } from "@/lib/stripe/client";

export type BillingInfo = {
  planoNome: string;
  mensalCents: number;
  status: string; // ativo | inadimplente | cancelado | ...
  temCheckout: boolean; // Stripe configurado + preço do plano cadastrado
  temAssinatura: boolean; // já tem customer no Stripe
  stripeAtivo: boolean; // STRIPE_SECRET_KEY presente
};

const VAZIO: BillingInfo = {
  planoNome: "",
  mensalCents: 0,
  status: "",
  temCheckout: false,
  temAssinatura: false,
  stripeAtivo: false,
};

export async function getBillingInfo(): Promise<BillingInfo> {
  const stripeAtivo = temStripe();
  const tid = await getTenantId();
  if (!tid) return { ...VAZIO, stripeAtivo };
  const sb = getCrmServer();
  const { data: t } = await sb
    .from("app_tenants")
    .select("plano,status,stripe_customer_id")
    .eq("id", tid)
    .maybeSingle();
  if (!t) return { ...VAZIO, stripeAtivo };
  const { data: plano } = await sb
    .from("app_plans")
    .select("nome,mensal_cents,stripe_price_id")
    .eq("id", t.plano)
    .maybeSingle();
  return {
    planoNome: plano?.nome ?? t.plano ?? "",
    mensalCents: plano?.mensal_cents ?? 0,
    status: t.status ?? "",
    temCheckout: stripeAtivo && Boolean(plano?.stripe_price_id),
    temAssinatura: Boolean(t.stripe_customer_id),
    stripeAtivo,
  };
}
