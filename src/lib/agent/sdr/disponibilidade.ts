import { getCrmAdmin } from "@/lib/supabase/admin";
import { listarEventosGoogle } from "@/lib/google/calendar";

// Janela de atendimento padrão (BRT). Serviços longos (ex.: 4h) cabem até 17:00.
const ABRE = 8;
const FECHA = 21;

/**
 * Lê os horários LIVRES de um dia, cruzando a Agenda do app (app_agendamentos)
 * com o Google Calendar do cliente. Considera a duração do serviço (uma janela
 * só é livre se o serviço inteiro couber). Retorna texto pronto para a IA usar.
 */
export async function consultarDisponibilidade(
  tenantId: string,
  dataISO: string,
  duracaoMin?: number
): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return "Data inválida — use AAAA-MM-DD.";
  const dur = Number(duracaoMin) > 0 ? Number(duracaoMin) : 60;

  const dayStart = new Date(`${dataISO}T00:00:00-03:00`);
  const dayEnd = new Date(`${dataISO}T23:59:59-03:00`);

  // Ocupados na Agenda do app (inclui bloqueios e agendamentos).
  const admin = getCrmAdmin();
  const { data: ags } = await admin
    .from("app_agendamentos")
    .select("inicio,fim")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelado")
    .lt("inicio", dayEnd.toISOString())
    .gt("fim", dayStart.toISOString());

  const busy: { ini: number; fim: number }[] = (ags ?? []).map((a) => ({
    ini: new Date(a.inicio).getTime(),
    fim: new Date((a.fim as string | null) ?? a.inicio).getTime(),
  }));

  // Ocupados no Google Calendar do cliente.
  try {
    const evs = await listarEventosGoogle(tenantId, dayStart.toISOString(), dayEnd.toISOString());
    for (const e of evs) busy.push({ ini: new Date(e.inicioISO).getTime(), fim: new Date(e.fimISO).getTime() });
  } catch {
    /* sem Google = considera só o app */
  }

  const agora = Date.now();
  const horas = dur / 60;
  const livres: string[] = [];
  for (let h = ABRE; h + horas <= FECHA; h++) {
    const s = new Date(`${dataISO}T${String(h).padStart(2, "0")}:00:00-03:00`).getTime();
    const e = s + dur * 60000;
    if (s < agora) continue; // não oferece horário que já passou
    const ocupado = busy.some((b) => s < b.fim && e > b.ini);
    if (!ocupado) livres.push(`${String(h).padStart(2, "0")}:00`);
  }

  const fmt = dataISO.split("-").reverse().join("/");
  if (livres.length === 0)
    return `Não há horário livre em ${fmt} para um serviço de ${dur} min. Ofereça outro dia.`;
  return `Horários LIVRES em ${fmt} para um serviço de ${dur} min: ${livres.join(", ")}. Ofereça esses ao lead e, quando ele escolher, marque com agendar_reuniao usando a mesma duração.`;
}
