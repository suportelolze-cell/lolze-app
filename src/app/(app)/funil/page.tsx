import { Funil } from "@/components/funil/Funil";
import { getFunilDados } from "@/lib/supabase/crm-data";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const dados = await getFunilDados();
  return <Funil dados={dados} />;
}
