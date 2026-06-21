import { getCrmAdmin } from "@/lib/supabase/admin";
import { getAccessToken } from "./oauth";

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
