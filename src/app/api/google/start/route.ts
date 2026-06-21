import { NextRequest, NextResponse } from "next/server";
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
  return NextResponse.redirect(getAuthUrl(redirectUri(req), s.tenantId));
}
