import { Configuracoes } from "@/components/config/Configuracoes";
import { getConfig, getAtendimentoCfg, getIaAtiva } from "@/lib/supabase/crm-data";
import { getRespostasRapidasRaw } from "@/lib/atendimento/respostas";
import { getBillingInfo } from "@/lib/billing/data";
import { getEquipeInfo } from "@/lib/team/data";
import { getGoogleStatus } from "@/lib/google/oauth";
import { getTenantId } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const tid = await getTenantId();
  const [config, equipeInfo, respostas, billing, google, atendimento, iaAtiva] = await Promise.all([
    getConfig(),
    getEquipeInfo(),
    getRespostasRapidasRaw(),
    getBillingInfo(),
    getGoogleStatus(tid),
    getAtendimentoCfg(),
    getIaAtiva(),
  ]);
  return (
    <Configuracoes
      config={config}
      equipeInfo={equipeInfo}
      respostasRapidas={respostas}
      billing={billing}
      google={google}
      atendimento={atendimento}
      iaAtiva={iaAtiva}
    />
  );
}
