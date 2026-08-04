import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarFollowup } from "@/lib/agent/followup";
import { processarLembretes } from "@/lib/agent/lembretes";
import { processarCaptacao } from "@/lib/captacao/enviar";
import { reenviarFalhados } from "@/lib/integracoes/reenvio-cron";
import { sincronizarMetaTodos } from "@/lib/trafego/meta-sync";
import { sincronizarGoogleTodos } from "@/lib/trafego/google-sync";

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
  const agoraISO = new Date().toISOString();
  const { data } = await admin
    .from("app_leads")
    .select("id,tenant_id")
    .not("proximo_followup", "is", null)
    .lte("proximo_followup", agoraISO)
    .is("atendente_id", null)
    .not("coluna", "in", "(ganho,perdido,atencao,agendado)")
    .order("proximo_followup", { ascending: true })
    .limit(20);

  // Pós-venda: clientes 'ganho' na trilha de acompanhamento recorrente (o SELECT
  // acima os exclui de propósito; aqui buscamos só quem está em modo 'posvenda').
  // Limite menor + total ≤25 mantém o teto pré-existente de gerações de IA por
  // ciclo (cada toque é 1 chamada de LLM; maxDuration=60 no handler).
  const { data: pv } = await admin
    .from("app_leads")
    .select("id,tenant_id")
    .eq("coluna", "ganho")
    .eq("followup_modo", "posvenda")
    .not("proximo_followup", "is", null)
    .lte("proximo_followup", agoraISO)
    .is("atendente_id", null)
    .order("proximo_followup", { ascending: true })
    .limit(5);

  const leads = ([...(data ?? []), ...(pv ?? [])] as { id: number; tenant_id: string }[]);
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

  // Prospecção assistida (envio automático em baixo volume)
  let captacao = { enviados: 0 };
  try {
    captacao = await processarCaptacao();
  } catch {
    // best-effort
  }

  // Outbox: reenvia mensagens de saída que falharam (canal caído) com backoff.
  let reenvio = { reenviadas: 0, mortas: 0 };
  try {
    reenvio = await reenviarFalhados();
  } catch {
    // best-effort
  }

  // Ingestão de tráfego (Meta Ads → app_trafego). Idempotente por (tenant,dia,
  // fonte); alimenta o investimento/CPA do painel e o topo do Raio-X do Funil.
  let trafego = { tenants: 0, ok: 0, linhas: 0 };
  try {
    trafego = await sincronizarMetaTodos();
  } catch {
    // best-effort
  }

  // Ingestão de tráfego (Google Ads → app_trafego, fonte 'google_ads').
  let trafegoGoogle = { tenants: 0, ok: 0, linhas: 0 };
  try {
    trafegoGoogle = await sincronizarGoogleTodos();
  } catch {
    // best-effort
  }

  return NextResponse.json({
    ok: true,
    processados: leads.length,
    enviados,
    lembretes,
    captacao,
    reenvio,
    trafego,
    trafegoGoogle,
  });
}
