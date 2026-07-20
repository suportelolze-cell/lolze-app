import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";
import { tenantPorContaIg } from "@/lib/instagram/client";
import { registrarErro } from "@/lib/observability/erros";
import { registrarEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // teto do processamento em background (waitUntil)

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * Webhook do Instagram (Meta Graph API).
 * GET  → verificação do webhook (hub.challenge) na configuração do App.
 * POST → mensagens recebidas: valida a assinatura da Meta, deduplica pelo mid,
 *        responde 200 imediatamente (exigência da Meta) e processa em
 *        background: resolve tenant, grava lead/mensagem e dispara o SDR.
 *
 * Configure no App da Meta:
 *   Callback URL: https://www.app.lolze.com.br/api/instagram/webhook
 *   Verify Token: o mesmo valor de IG_VERIFY_TOKEN (env da Vercel)
 *   App Secret:   em META_APP_SECRET (env da Vercel) — liga a validação de assinatura
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
  const raw = await req.text();

  // Assinatura da Meta (X-Hub-Signature-256 = HMAC-SHA256 do corpo com o App
  // Secret). Exigida quando META_APP_SECRET está configurado; sem a env, o
  // payload é aceito (compatibilidade) — configurar é item do checklist P0.
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appSecret) {
    const recebida = req.headers.get("x-hub-signature-256") || "";
    const esperada =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
    let valida = false;
    try {
      valida =
        recebida.length === esperada.length &&
        crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada));
    } catch {
      valida = false;
    }
    if (!valida) return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  let admin: Admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];

  // A Meta exige 200 rápido; o processamento segue em background.
  waitUntil(
    processarEntradasIg(admin, entries).catch((e) =>
      registrarErro({ contexto: "instagram.webhook.async", erro: e, severidade: "alta" })
    )
  );
  return NextResponse.json({ ok: true });
}

async function processarEntradasIg(admin: Admin, entries: any[]) {
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

      // Dedup pelo id da mensagem da Meta (reenvio do webhook não duplica).
      const externalId = String(msg?.mid || "").trim() || null;
      if (externalId) {
        const { data: dup } = await admin
          .from("app_mensagens")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_message_id", externalId)
          .limit(1)
          .maybeSingle();
        if (dup) continue;
      }

      // Localiza/cria o lead (tenant, instagram, remetente).
      type LeadRow = { id: number; atendente_id: string | null; followup_modo: string | null };
      let lead: LeadRow | null = null;
      {
        const { data } = await admin
          .from("app_leads")
          .select("id,atendente_id,followup_modo")
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
        if (lead.followup_modo === "reativacao") {
          await registrarEvento({
            tenantId,
            leadId: lead.id,
            tipo: "lead_reactivated",
            canal: "instagram",
            dados: { modo: "automatico" },
          });
        }
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
        lead = { ...(data as { id: number; atendente_id: string | null }), followup_modo: null };
        await registrarEvento({
          tenantId,
          leadId: lead.id,
          tipo: "lead_received",
          canal: "instagram",
          origem: "instagram",
        });
      }

      const { error: errM } = await admin.from("app_mensagens").insert({
        tenant_id: tenantId,
        lead_id: lead!.id,
        autor: "lead",
        texto,
        external_message_id: externalId,
      });
      if (errM) {
        // 23505 = corrida com outra entrega do mesmo evento → já processado.
        if ((errM as { code?: string }).code === "23505") continue;
        await registrarErro({
          tenantId,
          leadId: lead!.id,
          contexto: "instagram.webhook",
          erro: errM.message,
          severidade: "alta",
        });
        continue;
      }

      if (!lead!.atendente_id) {
        try {
          await executarSDR(tenantId, lead!.id);
        } catch (e) {
          await registrarErro({
            tenantId,
            leadId: lead!.id,
            contexto: "instagram.webhook",
            erro: e,
            severidade: "alta",
          });
        }
      }
    }
  }
}
