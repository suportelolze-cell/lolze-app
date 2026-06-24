import { Agenda } from "@/components/agenda/Agenda";
import { getAgendamentosApp, getOcupadosGoogle } from "@/lib/supabase/agenda-app";
import { getGoogleStatus } from "@/lib/google/oauth";
import { getTenantId } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const tid = await getTenantId();
  const [agendamentos, google, status] = await Promise.all([
    getAgendamentosApp(),
    getOcupadosGoogle(),
    getGoogleStatus(tid),
  ]);
  return (
    <Agenda
      agendamentos={[...agendamentos, ...google]}
      googleConectado={status.conectado}
    />
  );
}
