import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/tenant";
import { getBillingInfo } from "@/lib/billing/data";
import { Paywall } from "@/components/assinatura/Paywall";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const s = await getSessao();
  if (!s.userId) redirect("/login");
  if (s.papel === "superadmin") redirect("/painel"); // admin nunca é bloqueado
  const billing = await getBillingInfo();
  if (billing.status === "ativo") redirect("/painel"); // já pago → entra
  return <Paywall billing={billing} papel={s.papel} />;
}
