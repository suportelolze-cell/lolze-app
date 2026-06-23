import { Atendimento } from "@/components/atendimento/Atendimento";
import { getConversas } from "@/lib/supabase/crm-data";
import { getRespostasRapidas } from "@/lib/atendimento/respostas";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: { conversa?: string };
}) {
  const [conversas, sessao, respostas] = await Promise.all([
    getConversas(),
    getSessao(),
    getRespostasRapidas(),
  ]);
  const conversaInicial = Number(searchParams?.conversa) || null;
  return (
    <Atendimento
      initialConversas={conversas}
      currentUserId={sessao.userId ?? ""}
      podeOverride={sessao.papel === "owner" || sessao.papel === "superadmin"}
      respostasRapidas={respostas}
      conversaInicial={conversaInicial}
    />
  );
}
