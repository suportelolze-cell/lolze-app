import { Recorrencia } from "@/components/recorrencia/Recorrencia";
import { getRecorrencia } from "@/lib/supabase/crm-data";

export const dynamic = "force-dynamic";

export default async function RecorrenciaPage() {
  const dados = await getRecorrencia();
  return <Recorrencia dados={dados} />;
}
