import { Agenda } from "@/components/agenda/Agenda";
import { getAgendamentosApp, getOcupadosGoogle } from "@/lib/supabase/agenda-app";
import { getGoogleStatus } from "@/lib/google/oauth";
import { getTenantId } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: { searchParams: { ref?: string } }) {
  // Data de referência (default hoje), no fuso BR.
  const refValido = searchParams.ref && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.ref);
  const ref = refValido ? new Date(`${searchParams.ref}T12:00:00-03:00`) : new Date();
  const refISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(ref);

  // Intervalo do mês de referência (+/- 7 dias p/ cobrir semanas que cruzam a virada).
  const [ano, mes] = refISO.split("-").map(Number);
  const inicioMes = new Date(`${ano}-${String(mes).padStart(2, "0")}-01T00:00:00-03:00`);
  const fimMes = new Date(inicioMes);
  fimMes.setMonth(fimMes.getMonth() + 1);
  const min = new Date(inicioMes);
  min.setDate(min.getDate() - 7);
  const max = new Date(fimMes);
  max.setDate(max.getDate() + 7);

  const tid = await getTenantId();
  const [agendamentos, google, status] = await Promise.all([
    getAgendamentosApp(),
    getOcupadosGoogle(min.toISOString(), max.toISOString()),
    getGoogleStatus(tid),
  ]);
  return (
    <Agenda
      agendamentos={[...agendamentos, ...google]}
      googleConectado={status.conectado}
      refISO={refISO}
    />
  );
}
