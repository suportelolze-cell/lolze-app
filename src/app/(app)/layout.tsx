import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmServer } from "@/lib/supabase/server";
import { getCrmAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessao();

  // Gate de pagamento FAIL-CLOSED: só o status "ativo" libera o app. Status
  // desconhecido, tenant sem registro ou erro de consulta → /assinatura
  // (Paywall), nunca acesso liberado por engano. O superadmin NUNCA é
  // bloqueado (nem impersonando um cliente não-pago).
  if (s.papel !== "superadmin" && s.tenantId) {
    let status: string | null = null;
    try {
      const admin = getCrmAdmin();
      const { data } = await admin.from("app_tenants").select("status").eq("id", s.tenantId).maybeSingle();
      status = ((data?.status as string | null) ?? "").toLowerCase();
    } catch {
      status = null; // não deu pra confirmar → trata como não-ativo
    }
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

  return (
    <AppShell papel={s.papel} impersonating={s.impersonating} clienteNome={clienteNome}>
      {children}
    </AppShell>
  );
}
