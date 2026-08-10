import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getCrmServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Callback de e-mail do Supabase (recuperação de senha, confirmação de cadastro).
 * O link do e-mail chega aqui com um `code` (PKCE) ou `token_hash`+`type`.
 * Trocamos por uma sessão (cookie) e seguimos para o `next`.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Só aceita caminho relativo interno (evita open redirect).
  const nextRaw = searchParams.get("next") || "/painel";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/painel";

  const supabase = await getCrmServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // Link ausente/inválido/expirado: manda pedir um novo.
  return NextResponse.redirect(new URL("/auth/forgot?erro=link", origin));
}
