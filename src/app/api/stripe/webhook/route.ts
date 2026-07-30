import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { verificarWebhook, statusAssinaturaStripe } from "@/lib/stripe/client";
import { registrarErro } from "@/lib/observability/erros";
import { registrarFunilLolze } from "@/lib/funil-lolze";

export const dynamic = "force-dynamic";

/**
 * Webhook do Stripe. Atualiza o status de assinatura do cliente.
 *
 * Confiabilidade (P0):
 * - IDEMPOTENTE por event.id (app_stripe_eventos): reenvio do Stripe não
 *   reprocessa.
 * - Falha de banco → responde 5xx para o Stripe RETENTAR (antes o erro era
 *   engolido e respondido 200, perdendo o evento para sempre).
 *
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

  let admin: ReturnType<typeof getCrmAdmin>;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const obj = evento?.data?.object ?? {};
  const eventoId = String(evento?.id || "");

  // Idempotência: evento já processado → 200 direto.
  if (eventoId) {
    const { data: dup, error: errDup } = await admin
      .from("app_stripe_eventos")
      .select("id")
      .eq("id", eventoId)
      .maybeSingle();
    if (errDup) return NextResponse.json({ erro: "banco indisponivel" }, { status: 500 });
    if (dup) return NextResponse.json({ received: true, duplicado: true });
  }

  async function setStatusPorCustomer(customerId: string, status: string) {
    if (!customerId) return;
    const { error } = await admin
      .from("app_tenants")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);
    if (error) throw new Error("app_tenants: " + error.message);
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const tenantId = obj?.metadata?.tenant_id;
        if (tenantId) {
          const { error } = await admin
            .from("app_tenants")
            .update({
              stripe_customer_id: obj.customer ?? null,
              stripe_subscription_id: obj.subscription ?? null,
              status: "ativo",
              updated_at: new Date().toISOString(),
            })
            .eq("id", tenantId);
          if (error) throw new Error("app_tenants: " + error.message);
          // Funil da Lolze: pagamento confirmado → conta ativa.
          await registrarFunilLolze("pagamento_confirmado", { tenant_id: tenantId });
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
        // FAIL-CLOSED (antes: `?? "ativo"` marcava incomplete/paused como ativo).
        await setStatusPorCustomer(obj.customer, statusAssinaturaStripe(obj.status));
        break;
      }
    }
  } catch (e) {
    // 5xx → o Stripe retenta com backoff; nada de perder evento em silêncio.
    await registrarErro({ contexto: "stripe.webhook", erro: e, severidade: "alta" });
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }

  // Marca como processado só APÓS o sucesso (falha acima deixa o evento
  // elegível para a retentativa do Stripe).
  if (eventoId) {
    await admin
      .from("app_stripe_eventos")
      .upsert(
        { id: eventoId, tipo: String(evento.type || "") },
        { onConflict: "id", ignoreDuplicates: true }
      );
  }

  return NextResponse.json({ received: true });
}
