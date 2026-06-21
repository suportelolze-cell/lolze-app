import { Agenda } from "@/components/agenda/Agenda";
import { getAgendamentosApp } from "@/lib/supabase/agenda-app";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const agendamentos = await getAgendamentosApp();
  return <Agenda agendamentos={agendamentos} />;
}
