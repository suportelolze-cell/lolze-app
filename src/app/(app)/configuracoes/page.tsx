import { Configuracoes } from "@/components/config/Configuracoes";
import { getConfig } from "@/lib/supabase/crm-data";
import { getEquipeInfo } from "@/lib/team/data";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [config, equipeInfo] = await Promise.all([getConfig(), getEquipeInfo()]);
  return <Configuracoes config={config} equipeInfo={equipeInfo} />;
}
