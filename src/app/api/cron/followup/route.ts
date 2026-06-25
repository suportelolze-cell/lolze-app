import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarFollowup } from "@/lib/agent/followup";
import { processarLembretes } from "@/lib/agent/lembretes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron de follow-up (todos os clientes). Roda a cada ~15 min (vercel.json).
 * Pega os leads cujo próximo toque venceu e envia. Protegido pelo CRON_SECRET
 * (a Vercel manda Authorization: Bearer <CRON_SECRET> automaticamente).
 */
export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET configurado, o endpoint NÃO roda (evita que
  // qualquer um dispare follow-ups em massa). A Vercel manda o header sozinha.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_leads")
    .select("id,tenant_id")
    .not("proximo_followup", "is", null)
    .lte("proximo_followup", new Date().toISOString())
    .is("atendente_id", null)
    .not("coluna", "in", "(ganho,perdido,atencao,agendado)")
    .order("proximo_followup", { ascending: true })
    .limit(25);

  const leads = (data ?? []) as { id: number; tenant_id: string }[];
  let enviados = 0;
  for (const l of leads) {
    try {
      await enviarFollowup(l.tenant_id, l.id);
      enviados++;
    } catch {
      // best-effort: um erro num lead não derruba o lote
    }
  }

  // Lembretes de reunião (24h / 2h antes)
  let lembretes = { enviados24h: 0, enviados2h: 0 };
  try {
    lembretes = await processarLembretes();
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, processados: leads.length, enviados, lembretes });
}
