import { AppShell } from "@/components/app/AppShell";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessao();

  let clienteNome = "";
  if (s.impersonating && s.tenantId) {
    const sb = getCrmServer();
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
