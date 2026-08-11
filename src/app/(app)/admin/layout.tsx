import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/tenant";
import { ROTAS } from "@/lib/rotas";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessao();
  if (s.papel !== "superadmin") redirect(ROTAS.app.painel);
  return <>{children}</>;
}
