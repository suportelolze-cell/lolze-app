import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessao } from "@/lib/supabase/tenant";
import { temGoogleConfig, getAuthUrl } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

function redirectUri(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ?? (req.nextUrl.hostname === "localhost" ? "http" : "https");
  return `${proto}://${req.headers.get("host")}/api/google/callback`;
}

/** Inicia o OAuth do Google para o cliente logado (dono ou superadmin impersonando). */
export async function GET(req: NextRequest) {
  const s = await getSessao();
  const pode = s.papel === "owner" || s.papel === "superadmin";
  if (!s.tenantId || !pode) return NextResponse.redirect(new URL("/configuracoes", req.url));
  if (!temGoogleConfig())
    return NextResponse.redirect(new URL("/configuracoes?google=semconfig", req.url));

  // Nonce anti-CSRF: vai no state e num cookie httpOnly; o callback exige que
  // batam (senão um state forjado com o tenantId — que é previsível — poderia
  // conectar a conta Google do atacante ao tenant da vítima).
  const nonce = randomUUID();
  const res = NextResponse.redirect(getAuthUrl(redirectUri(req), `${s.tenantId}:${nonce}`));
  res.cookies.set("google_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
