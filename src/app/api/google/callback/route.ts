import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/supabase/tenant";
import { exchangeCode } from "@/lib/google/oauth";
import { getCrmAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function redirectUri(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ?? (req.nextUrl.hostname === "localhost" ? "http" : "https");
  return `${proto}://${req.headers.get("host")}/api/google/callback`;
}

/** Recebe o retorno do Google: troca o code por tokens e salva no tenant. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.get("error"))
    return NextResponse.redirect(new URL("/configuracoes?google=erro", req.url));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // "<tenantId>:<nonce>" do /start
  if (!code || !state)
    return NextResponse.redirect(new URL("/configuracoes?google=erro", req.url));

  // CSRF: o nonce do state tem que bater com o cookie httpOnly gravado no /start.
  const [stateTenant, stateNonce] = state.split(":");
  const nonceCookie = req.cookies.get("google_oauth_nonce")?.value ?? "";
  if (!stateTenant || !stateNonce || !nonceCookie || stateNonce !== nonceCookie) {
    return NextResponse.redirect(new URL("/configuracoes?google=erro", req.url));
  }

  // Só o dono daquele tenant (ou superadmin) finaliza a conexão.
  const s = await getSessao();
  const pode = s.papel === "superadmin" || (s.papel === "owner" && s.tenantId === stateTenant);
  if (!pode) return NextResponse.redirect(new URL("/configuracoes?google=erro", req.url));

  try {
    const { refreshToken, email } = await exchangeCode(code, redirectUri(req));
    const admin = getCrmAdmin();
    const patch: Record<string, unknown> = {
      tenant_id: stateTenant,
      updated_at: new Date().toISOString(),
    };
    // refresh_token só vem no 1º consentimento; prompt=consent garante que venha.
    if (refreshToken) patch.google_refresh_token = refreshToken;
    // O calendário primário tem como id o próprio e-mail da conta conectada.
    if (email) patch.google_calendar_id = email;
    await admin.from("app_tenant_secrets").upsert(patch, { onConflict: "tenant_id" });
    const res = NextResponse.redirect(new URL("/configuracoes?google=ok", req.url));
    res.cookies.delete("google_oauth_nonce"); // nonce é de uso único
    return res;
  } catch {
    return NextResponse.redirect(new URL("/configuracoes?google=erro", req.url));
  }
}
