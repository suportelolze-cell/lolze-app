import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessao();
  if (s.papel !== "superadmin") redirect("/painel");
  return <>{children}</>;
}
