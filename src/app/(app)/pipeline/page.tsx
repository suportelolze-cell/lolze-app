import { Board } from "@/components/pipeline/Board";
import { getLeads } from "@/lib/supabase/crm-data";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const leads = await getLeads();
  return <Board initialLeads={leads} />;
}
