import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Consulta se um humano (SDR) assumiu a conversa, SEM gravar nada.
 * Útil para o n8n decidir se a IA deve responder, ou para o disparo de
 * reativação pular leads que já estão em atendimento humano.
 *
 * GET /api/handoff?canal=whatsapp&user=<canal_user_id>
 * Authorization: Bearer <ingest_token do cliente>
 *
 * Resposta: { ok, encontrado, humanoAtivo, comando, leadId }
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  let admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const { data: secret } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!secret) return NextResponse.json({ erro: "token invalido" }, { status: 401 });

  const tenantId = secret.tenant_id as string;
  const canal = (req.nextUrl.searchParams.get("canal") || "whatsapp").trim();
  const user = (req.nextUrl.searchParams.get("user") || "").trim();
  if (!user) return NextResponse.json({ erro: "parametro user ausente" }, { status: 400 });

  const { data: lead } = await admin
    .from("app_leads")
    .select("id,comando,atendente_id")
    .eq("tenant_id", tenantId)
    .eq("canal", canal)
    .eq("canal_user_id", user)
    .limit(1)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ ok: true, encontrado: false, humanoAtivo: false, comando: "ia" });
  }

  return NextResponse.json({
    ok: true,
    encontrado: true,
    humanoAtivo: !!lead.atendente_id,
    comando: lead.comando,
    leadId: lead.id,
  });
}
