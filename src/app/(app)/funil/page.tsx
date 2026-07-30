import { FunilDynamic } from "@/components/funil/FunilDynamic";
import { getFunilDados } from "@/lib/supabase/crm-data";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const dados = await getFunilDados();
  return <FunilDynamic dados={dados} />;
}
