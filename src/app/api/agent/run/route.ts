import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // turnos com tool-use podem levar alguns segundos

/**
 * Cérebro do SDR. O n8n chama isto DEPOIS de /api/ingest gravar a mensagem do
 * lead — tipicamente apenas quando o estado retornado indicar que a IA deve
 * responder (sem humano no comando, sem precisa_humano).
 *
 * POST /api/agent/run
 * Authorization: Bearer <ingest_token do cliente>
 * body: { leadId: number }
 *
 * Resposta: { ok, reply, acoes, skipped?, erro? }
 */
export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  const leadId = Number((body as { leadId?: unknown })?.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ erro: "leadId invalido" }, { status: 400 });
  }

  try {
    const r = await executarSDR(tenantId, leadId);
    return NextResponse.json({
      ok: r.ok,
      reply: r.resposta,
      acoes: r.acoes,
      skipped: r.skipped,
      erro: r.erro,
    });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "erro desconhecido";
    return NextResponse.json({ ok: false, erro }, { status: 500 });
  }
}
