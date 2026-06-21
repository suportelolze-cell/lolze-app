import { Atendimento } from "@/components/atendimento/Atendimento";
import { getConversas } from "@/lib/supabase/crm-data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage() {
  const [conversas, sessao] = await Promise.all([getConversas(), getSessao()]);
  return (
    <Atendimento
      initialConversas={conversas}
      currentUserId={sessao.userId ?? ""}
      podeOverride={sessao.papel === "owner" || sessao.papel === "superadmin"}
    />
  );
}
