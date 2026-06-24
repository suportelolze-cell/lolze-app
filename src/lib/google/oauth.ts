import { getCrmAdmin } from "@/lib/supabase/admin";

/** Integração Google Calendar (OAuth por cliente). SERVER-ONLY. */

const SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

export function temGoogleConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export type GoogleStatus = { configurado: boolean; conectado: boolean; email: string | null };

/** Status da integração Google para um tenant: credenciais no servidor + conexão do cliente. */
export async function getGoogleStatus(tenantId: string | null): Promise<GoogleStatus> {
  const configurado = temGoogleConfig();
  if (!tenantId) return { configurado, conectado: false, email: null };
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("google_refresh_token,google_calendar_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    configurado,
    conectado: Boolean(data?.google_refresh_token),
    email: data?.google_calendar_id ?? null,
  };
}

/** URL de consentimento do Google (state = tenantId). */
export function getAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

/** Troca o code por tokens; busca o e-mail da conta conectada. */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken?: string; accessToken: string; email?: string }> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error("token exchange: " + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { refresh_token?: string; access_token: string };

  let email: string | undefined;
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${j.access_token}` },
    });
    if (u.ok) email = ((await u.json()) as { email?: string }).email;
  } catch {
    // sem e-mail não é problema
  }
  return { refreshToken: j.refresh_token, accessToken: j.access_token, email };
}

/** Access token fresco a partir do refresh token do cliente. null se não conectado. */
export async function getAccessToken(tenantId: string): Promise<string | null> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("google_refresh_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const rt = data?.google_refresh_token;
  if (!rt) return null;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token?: string };
  return j.access_token ?? null;
}
