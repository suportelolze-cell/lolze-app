import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmServer } from "@/lib/supabase/server";
import { statusCobrancaCacheado } from "@/lib/billing/paywall";
import { lerPlaybook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessao();

  // Gate de pagamento FAIL-CLOSED: só o status "ativo" libera o app. Status
  // desconhecido, tenant sem registro ou erro de consulta → /assinatura
  // (Paywall), nunca acesso liberado por engano. O superadmin NUNCA é
  // bloqueado (nem impersonando um cliente não-pago). O status é cacheado ~60s
  // (invalidado na hora pelo webhook do Stripe) — tira 1 query de cada navegação.
  if (s.papel !== "superadmin" && s.tenantId) {
    const status = await statusCobrancaCacheado(s.tenantId);
    if (status !== "ativo") redirect("/assinatura");
  }

  let clienteNome = "";
  if (s.impersonating && s.tenantId) {
    const sb = await getCrmServer();
    const { data } = await sb
      .from("app_tenants")
      .select("nome")
      .eq("id", s.tenantId)
      .maybeSingle();
    clienteNome = data?.nome ?? "";
  }

  const playbook = await lerPlaybook();

  return (
    <AppShell
      papel={s.papel}
      impersonating={s.impersonating}
      clienteNome={clienteNome}
      playbook={playbook}
    >
      {children}
    </AppShell>
  );
}
