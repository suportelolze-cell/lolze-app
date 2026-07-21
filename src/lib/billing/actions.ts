"use server";

import { revalidatePath } from "next/cache";
import { getCrmServer } from "@/lib/supabase/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { criarCheckout, criarPortal, criarProdutoEPreco, temStripe } from "@/lib/stripe/client";
import { registrarFunilLolze } from "@/lib/funil-lolze";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/**
 * (Superadmin) Cria no Stripe o Produto + Preço mensal de cada plano pagável
 * que ainda não tem `stripe_price_id`, usando a STRIPE_SECRET_KEY do servidor.
 * Assim o admin ativa a cobrança com um clique, sem expor a chave.
 */
export async function criarPrecosStripe(): Promise<{ ok: boolean; criados: number; erro?: string }> {
  const s = await getSessao();
  if (s.papel !== "superadmin") return { ok: false, criados: 0, erro: "Acesso restrito ao administrador." };
  if (!temStripe()) return { ok: false, criados: 0, erro: "STRIPE_SECRET_KEY não está configurada na Vercel." };

  const admin = getCrmAdmin();
  const { data: planos } = await admin
    .from("app_plans")
    .select("id,nome,mensal_cents,stripe_price_id")
    .gt("mensal_cents", 0);

  let criados = 0;
  for (const p of (planos ?? []) as Array<{ id: string; nome: string; mensal_cents: number; stripe_price_id: string | null }>) {
    if (p.stripe_price_id) continue; // já tem preço
    const priceId = await criarProdutoEPreco({ nome: `Lolze ${p.nome}`, mensalCents: p.mensal_cents });
    if (priceId) {
      await admin.from("app_plans").update({ stripe_price_id: priceId }).eq("id", p.id);
      criados++;
    }
  }
  revalidatePath("/admin/planos");
  return { ok: true, criados };
}

/** Inicia o checkout de assinatura do plano do tenant. Devolve a URL do Stripe. */
export async function assinarPlano(): Promise<{ url?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { erro: "Sem permissão." };
  const sb = await getCrmServer();
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
  if (url) {
    await registrarFunilLolze("checkout_iniciado", {
      origem: "assinatura",
      tenant_id: s.tenantId,
    });
  }
  return url ? { url } : { erro: "Não foi possível iniciar o pagamento." };
}

/** Abre o Portal do Cliente do Stripe (gerenciar/cancelar). Devolve a URL. */
export async function gerenciarAssinatura(): Promise<{ url?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { erro: "Sem permissão." };
  const sb = await getCrmServer();
  const { data: t } = await sb
    .from("app_tenants")
    .select("stripe_customer_id")
    .eq("id", s.tenantId)
    .maybeSingle();
  if (!t?.stripe_customer_id) return { erro: "Sem assinatura ativa." };
  const url = await criarPortal(t.stripe_customer_id);
  return url ? { url } : { erro: "Não foi possível abrir o portal." };
}
