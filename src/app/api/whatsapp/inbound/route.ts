import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";
import { baixarMidiaBase64 } from "@/lib/evolution/client";
import { midiaParaTexto, type TipoMidia } from "@/lib/evolution/media";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // baixar mídia + transcrever + rodar o SDR

/**
 * Entrada direta do WhatsApp via Evolution (Opção B — sem n8n).
 * A própria instância manda o evento MESSAGES_UPSERT para cá; o app baixa e
 * transcreve a mídia, grava o lead/mensagem e dispara o SDR (que responde
 * direto pela Evolution via dispatchOutbound).
 *
 * URL configurada automaticamente pelo app:
 *   /api/whatsapp/inbound?t=<ingest_token do tenant>
 */
export async function POST(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("t") || "").trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  let admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const { data: secret } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id,evolution_instance")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!secret) return NextResponse.json({ erro: "token invalido" }, { status: 401 });
  const tenantId = secret.tenant_id as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignorado: "json" });
  }

  // Evolution pode enviar { event, instance, data } ou aninhar em body.
  const data = body?.data ?? body?.body?.data ?? body ?? {};
  const key = data?.key ?? {};
  const instancia = (secret.evolution_instance as string) || body?.instance || "";

  // Ignora: mensagens do próprio bot (evita loop), grupos e eventos sem mensagem.
  if (key?.fromMe) return NextResponse.json({ ok: true, ignorado: "fromMe" });
  const remoteJid = String(key?.remoteJid || "");
  if (!remoteJid || remoteJid.includes("@g.us"))
    return NextResponse.json({ ok: true, ignorado: "sem_jid_ou_grupo" });

  const canalUserId = remoteJid.replace(/@.*/, "");
  const nome = String(data?.pushName || canalUserId);
  const msg = data?.message ?? {};

  // Determina texto direto ou mídia a baixar.
  let texto = String(msg?.conversation || msg?.extendedTextMessage?.text || "").trim();
  let mediaTipo: TipoMidia | null = null;
  let caption = "";

  if (msg?.audioMessage) mediaTipo = "audio";
  else if (msg?.imageMessage) {
    mediaTipo = "imagem";
    caption = String(msg.imageMessage.caption || "");
  } else if (msg?.documentMessage || msg?.documentWithCaptionMessage) {
    mediaTipo = "documento";
    caption = String(msg.documentMessage?.caption || msg.documentWithCaptionMessage?.message?.documentMessage?.caption || "");
  } else if (msg?.videoMessage) {
    // Vídeo: sem transcrição por enquanto; usa a legenda se houver.
    caption = String(msg.videoMessage.caption || "");
    texto = texto || caption || "(o cliente enviou um vídeo)";
  }

  if (mediaTipo && instancia) {
    const midia = await baixarMidiaBase64(instancia, data);
    if (midia) {
      const t = await midiaParaTexto(mediaTipo, midia.base64, midia.mime);
      texto = [caption, t].filter(Boolean).join(" — ").trim();
    } else if (caption) {
      texto = caption;
    }
  }

  if (!texto) return NextResponse.json({ ok: true, ignorado: "sem_texto" });

  // Localiza/cria o lead (tenant, whatsapp, canal_user_id).
  type LeadRow = { id: number; atendente_id: string | null };
  let lead: LeadRow | null = null;
  {
    const { data } = await admin
      .from("app_leads")
      .select("id,atendente_id")
      .eq("tenant_id", tenantId)
      .eq("canal", "whatsapp")
      .eq("canal_user_id", canalUserId)
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
        nome,
        telefone: canalUserId,
        origem: "whatsapp",
        canal: "whatsapp",
        canal_user_id: canalUserId,
        temperatura: "frio",
        coluna: "entrada",
        ultima_msg: texto,
      })
      .select("id,atendente_id")
      .single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    lead = data as LeadRow;
  }

  const { error: errM } = await admin
    .from("app_mensagens")
    .insert({ tenant_id: tenantId, lead_id: lead!.id, autor: "lead", texto });
  if (errM) return NextResponse.json({ erro: errM.message }, { status: 500 });

  // Dispara o SDR (ele respeita handoff/agente_ativo e entrega a resposta).
  let resposta = "";
  if (!lead!.atendente_id) {
    try {
      const r = await executarSDR(tenantId, lead!.id);
      resposta = r.resposta;
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true, leadId: lead!.id, respondeu: Boolean(resposta) });
}
