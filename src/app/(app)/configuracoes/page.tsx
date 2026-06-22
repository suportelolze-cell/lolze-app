import { Configuracoes } from "@/components/config/Configuracoes";
import { getConfig } from "@/lib/supabase/crm-data";
import { getEquipeInfo } from "@/lib/team/data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [config, equipeInfo, sessao] = await Promise.all([
    getConfig(),
    getEquipeInfo(),
    getSessao(),
  ]);
  return (
    <Configuracoes
      config={config}
      equipeInfo={equipeInfo}
      ehAdmin={sessao.papel === "superadmin"}
    />
  );
}
