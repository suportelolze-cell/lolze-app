import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { verificarWebhook } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

/**
 * Webhook do Stripe. Atualiza o status de assinatura do cliente.
 * Configure no Stripe → Developers → Webhooks:
 *   URL: https://www.app.lolze.com.br/api/stripe/webhook
 *   eventos: checkout.session.completed, invoice.paid, invoice.payment_failed,
 *            customer.subscription.updated, customer.subscription.deleted
 *   o "Signing secret" vai em STRIPE_WEBHOOK_SECRET (env).
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const evento = verificarWebhook(payload, sig);
  if (!evento) return NextResponse.json({ erro: "assinatura inválida" }, { status: 400 });

  const admin = getCrmAdmin();
  const obj = evento?.data?.object ?? {};

  async function setStatusPorCustomer(customerId: string, status: string) {
    if (!customerId) return;
    await admin.from("app_tenants").update({ status, updated_at: new Date().toISOString() }).eq("stripe_customer_id", customerId);
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const tenantId = obj?.metadata?.tenant_id;
        if (tenantId) {
          await admin
            .from("app_tenants")
            .update({
              stripe_customer_id: obj.customer ?? null,
              stripe_subscription_id: obj.subscription ?? null,
              status: "ativo",
              updated_at: new Date().toISOString(),
            })
            .eq("id", tenantId);
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await setStatusPorCustomer(obj.customer, "ativo");
        break;
      case "invoice.payment_failed":
        await setStatusPorCustomer(obj.customer, "inadimplente");
        break;
      case "customer.subscription.deleted":
        await setStatusPorCustomer(obj.customer, "cancelado");
        break;
      case "customer.subscription.updated": {
        const map: Record<string, string> = {
          active: "ativo",
          trialing: "ativo",
          past_due: "inadimplente",
          unpaid: "inadimplente",
          canceled: "cancelado",
        };
        await setStatusPorCustomer(obj.customer, map[obj.status] ?? "ativo");
        break;
      }
    }
  } catch {
    // não falha o webhook por erro de update (Stripe re-tenta)
  }

  return NextResponse.json({ received: true });
}
