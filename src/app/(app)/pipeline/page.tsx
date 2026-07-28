import { Board } from "@/components/pipeline/Board";
import { getLeads } from "@/lib/supabase/crm-data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [leads, s] = await Promise.all([getLeads(), getSessao()]);
  const podeGerir = s.papel === "owner" || s.papel === "superadmin";
  return <Board initialLeads={leads} podeGerir={podeGerir} />;
}
