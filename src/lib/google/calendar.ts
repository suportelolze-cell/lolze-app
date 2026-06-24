import { getCrmAdmin } from "@/lib/supabase/admin";
import { getAccessToken } from "./oauth";

async function calendarioDoTenant(tenantId: string): Promise<string> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("google_calendar_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data?.google_calendar_id || "primary";
}

export type EventoGoogle = { id: string; summary: string; inicioISO: string; fimISO: string };

/**
 * Lista eventos do Google Calendar do cliente num intervalo. [] se não conectado.
 * Usado para mostrar na Agenda os compromissos que já existem no Google.
 */
export async function listarEventosGoogle(
  tenantId: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<EventoGoogle[]> {
  const token = await getAccessToken(tenantId);
  if (!token) return [];
  const cal = await calendarioDoTenant(tenantId);
  const p = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  try {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?` + p.toString(),
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };
    return (j.items ?? [])
      .map((e) => ({
        id: e.id ?? "",
        summary: e.summary || "Ocupado",
        inicioISO: e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00-03:00` : ""),
        fimISO: e.end?.dateTime || (e.end?.date ? `${e.end.date}T23:59:59-03:00` : ""),
      }))
      .filter((e) => e.inicioISO && e.fimISO);
  } catch {
    return [];
  }
}

/**
 * O horário está ocupado no Google Calendar do cliente? (freeBusy)
 * false se não conectado ou em erro — nesse caso a trava interna ainda vale.
 */
export async function horarioOcupadoGoogle(
  tenantId: string,
  inicioISO: string,
  fimISO: string
): Promise<boolean> {
  const token = await getAccessToken(tenantId);
  if (!token) return false;
  const cal = await calendarioDoTenant(tenantId);
  try {
    const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ timeMin: inicioISO, timeMax: fimISO, items: [{ id: cal }] }),
    });
    if (!r.ok) return false;
    const j = (await r.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };
    return (j.calendars?.[cal]?.busy ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Cria um evento no Google Calendar do cliente. Retorna o eventId ou null
 * (se o cliente não conectou o Google ou a chamada falhou). Best-effort.
 */
export async function criarEventoGoogle(
  tenantId: string,
  ev: { summary: string; descricao?: string; inicioISO: string; fimISO: string }
): Promise<string | null> {
  const token = await getAccessToken(tenantId);
  if (!token) return null;

  const admin = getCrmAdmin();
  const { data: s } = await admin
    .from("app_tenant_secrets")
    .select("google_calendar_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cal = s?.google_calendar_id || "primary";

  try {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          summary: ev.summary,
          description: ev.descricao || "",
          start: { dateTime: ev.inicioISO, timeZone: "America/Sao_Paulo" },
          end: { dateTime: ev.fimISO, timeZone: "America/Sao_Paulo" },
        }),
      }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id ?? null;
  } catch {
    return null;
  }
}
