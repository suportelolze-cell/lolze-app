import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/tenant";
import { ROTAS } from "@/lib/rotas";
import { getBillingInfo } from "@/lib/billing/data";
import { Paywall } from "@/components/assinatura/Paywall";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const s = await getSessao();
  if (!s.userId) redirect(ROTAS.auth.login);
  if (s.papel === "superadmin") redirect(ROTAS.app.painel); // admin nunca é bloqueado
  const billing = await getBillingInfo();
  if (billing.status === "ativo") redirect(ROTAS.app.painel); // já pago → entra
  return <Paywall billing={billing} papel={s.papel} />;
}
