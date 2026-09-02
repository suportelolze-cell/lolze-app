import { Atendimento } from "@/components/atendimento/Atendimento";
import { getConversas, getIaAtiva } from "@/lib/supabase/crm-data";
import { getRespostasRapidas } from "@/lib/atendimento/respostas";
import { getSessao } from "@/lib/supabase/tenant";
import { lerPlaybook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const [conversas, sessao, respostas, iaAtiva, playbook] = await Promise.all([
    getConversas(),
    getSessao(),
    getRespostasRapidas(),
    getIaAtiva(),
    lerPlaybook(),
  ]);
  const conversaInicial = Number((await searchParams)?.conversa) || null;
  return (
    <Atendimento
      initialConversas={conversas}
      currentUserId={sessao.userId ?? ""}
      podeOverride={sessao.papel === "owner" || sessao.papel === "superadmin"}
      respostasRapidas={respostas}
      conversaInicial={conversaInicial}
      iaAtiva={iaAtiva}
      playbook={playbook}
    />
  );
}
