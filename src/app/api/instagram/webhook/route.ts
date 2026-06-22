import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";
import { tenantPorContaIg } from "@/lib/instagram/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook do Instagram (Meta Graph API).
 * GET  → verificação do webhook (hub.challenge) na configuração do App.
 * POST → mensagens recebidas: resolve o tenant pela conta IG, grava o lead/
 *        mensagem e dispara o SDR (que responde direto pela Graph API).
 *
 * Configure no App da Meta:
 *   Callback URL: https://www.app.lolze.com.br/api/instagram/webhook
 *   Verify Token: o mesmo valor de IG_VERIFY_TOKEN (env da Vercel)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge") ?? "";
  if (mode === "subscribe" && token && token === process.env.IG_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = getCrmAdmin();
  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const eventos: any[] = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const ev of eventos) {
      const msg = ev?.message;
      if (!msg || msg.is_echo) continue; // ignora ecos (mensagens nossas)

      const contaIg = String(ev?.recipient?.id || entry?.id || "");
      const remetente = String(ev?.sender?.id || "");
      const texto = String(msg?.text || "").trim();
      if (!contaIg || !remetente || !texto) continue;

      const tenantId = await tenantPorContaIg(contaIg);
      if (!tenantId) continue; // conta IG não vinculada a nenhum cliente

      // Localiza/cria o lead (tenant, instagram, remetente).
      type LeadRow = { id: number; atendente_id: string | null };
      let lead: LeadRow | null = null;
      {
        const { data } = await admin
          .from("app_leads")
          .select("id,atendente_id")
          .eq("tenant_id", tenantId)
          .eq("canal", "instagram")
          .eq("canal_user_id", remetente)
          .limit(1)
          .maybeSingle();
        lead = data as LeadRow | null;
      }

      if (lead) {
        await admin
          .from("app_leads")
          .update({ ultima_msg: texto, updated_at: new Date().toISOString() })
          .eq("id", lead.id);
      } else {
        const { data, error } = await admin
          .from("app_leads")
          .insert({
            tenant_id: tenantId,
            nome: "Lead Instagram",
            origem: "instagram",
            canal: "instagram",
            canal_user_id: remetente,
            temperatura: "frio",
            coluna: "entrada",
            ultima_msg: texto,
          })
          .select("id,atendente_id")
          .single();
        if (error) continue;
        lead = data as LeadRow;
      }

      await admin
        .from("app_mensagens")
        .insert({ tenant_id: tenantId, lead_id: lead!.id, autor: "lead", texto });

      if (!lead!.atendente_id) {
        try {
          await executarSDR(tenantId, lead!.id);
        } catch {
          /* best-effort */
        }
      }
    }
  }

  // Meta exige 200 rápido.
  return NextResponse.json({ ok: true });
}
