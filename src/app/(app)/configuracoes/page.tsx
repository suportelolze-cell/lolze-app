import { Configuracoes } from "@/components/config/Configuracoes";
import { getConfig, getAtendimentoCfg, getIaAtiva } from "@/lib/supabase/crm-data";
import { getNumerosCaptacaoInfo } from "@/lib/captacao/data";
import { getRespostasRapidasRaw } from "@/lib/atendimento/respostas";
import { getBillingInfo } from "@/lib/billing/data";
import { getEquipeInfo } from "@/lib/team/data";
import { getGoogleStatus } from "@/lib/google/oauth";
import { getTenantId } from "@/lib/supabase/tenant";
import { listarDocs } from "@/lib/kb/data";
import { listarBiblioteca } from "@/lib/biblioteca/data";
import { lerPlaybook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const tid = await getTenantId();
  const [config, equipeInfo, respostas, billing, google, atendimento, iaAtiva, numerosCaptacao, docsKb, biblioteca, playbook] =
    await Promise.all([
      getConfig(),
      getEquipeInfo(),
      getRespostasRapidasRaw(),
      getBillingInfo(),
      getGoogleStatus(tid),
      getAtendimentoCfg(),
      getIaAtiva(),
      getNumerosCaptacaoInfo(),
      tid ? listarDocs(tid) : Promise.resolve([]),
      listarBiblioteca(),
      lerPlaybook(),
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
      numerosCaptacao={numerosCaptacao}
      docsKb={docsKb}
      biblioteca={biblioteca}
      playbook={playbook}
    />
  );
}
