import { Configuracoes } from "@/components/config/Configuracoes";
import { getConfig } from "@/lib/supabase/crm-data";
import { getRespostasRapidasRaw } from "@/lib/atendimento/respostas";
import { getBillingInfo } from "@/lib/billing/data";
import { getEquipeInfo } from "@/lib/team/data";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [config, equipeInfo, respostas, billing] = await Promise.all([
    getConfig(),
    getEquipeInfo(),
    getRespostasRapidasRaw(),
    getBillingInfo(),
  ]);
  return (
    <Configuracoes
      config={config}
      equipeInfo={equipeInfo}
      respostasRapidas={respostas}
      billing={billing}
    />
  );
}
