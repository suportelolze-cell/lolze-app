"use server";

import { getCrmAdmin } from "@/lib/supabase/admin";
import { provisionarTenant } from "./provisionar";
import { criarCheckout } from "@/lib/stripe/client";
import { ipDoCliente, dentroDoLimite, honeypot } from "@/lib/seguranca/antiabuso";

/**
 * Cadastro PÚBLICO (self-service): cria a conta na hora (status "pendente") e
 * devolve a URL do Stripe Checkout. O webhook do Stripe ativa a conta quando o
 * pagamento é confirmado (checkout.session.completed → status "ativo").
 * Sem intervenção do admin.
 */
export async function cadastroPublico(form: {
  nomeNegocio: string;
  nomeDono: string;
  email: string;
  senha: string;
  telefone?: string;
  plano: string;
  hp?: string;
}): Promise<{ ok: boolean; checkoutUrl?: string; erro?: string }> {
  // Anti-abuso: isca (bot) + limite por IP (self-service público).
  if (honeypot(form.hp)) return { ok: false, erro: "Não foi possível concluir o cadastro." };
  if (!(await dentroDoLimite("cadastro", ipDoCliente(), 5, 3600)))
    return { ok: false, erro: "Muitas tentativas deste dispositivo. Aguarde alguns minutos." };

  const nomeNegocio = (form.nomeNegocio || "").trim();
  const email = (form.email || "").trim().toLowerCase();
  if (!nomeNegocio) return { ok: false, erro: "Informe o nome do negócio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  if (!form.senha || form.senha.length < 6)
    return { ok: false, erro: "A senha precisa ter ao menos 6 caracteres." };
  if (!form.plano) return { ok: false, erro: "Escolha um plano." };

  let admin;
  try {
    admin = getCrmAdmin();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  const { data: plano } = await admin
    .from("app_plans")
    .select("id,stripe_price_id")
    .eq("id", form.plano)
    .maybeSingle();
  if (!plano) return { ok: false, erro: "Plano inválido." };

  // Cria a conta já (aguardando pagamento).
  const prov = await provisionarTenant({
    nomeNegocio,
    plano: form.plano,
    emailDono: email,
    nomeDono: form.nomeDono,
    senha: form.senha,
    telefone: form.telefone,
    status: "pendente",
  });
  if (!prov.ok || !prov.tenantId) return { ok: false, erro: prov.erro };

  // Sem preço no Stripe? a conta foi criada pendente (você libera manualmente).
  if (!plano.stripe_price_id) return { ok: true };

  const url = await criarCheckout({
    tenantId: prov.tenantId,
    priceId: plano.stripe_price_id,
    email,
    successPath: "/onboarding",
    cancelPath: "/onboarding?assinatura=cancel",
  });
  return { ok: true, checkoutUrl: url ?? undefined };
}
