import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";
import { baixarMidiaBase64, uploadMidia, puxarHistoricoContato } from "@/lib/evolution/client";
import { midiaParaTexto, type TipoMidia } from "@/lib/evolution/media";
import { registrarErro } from "@/lib/observability/erros";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // teto do processamento em background (waitUntil)

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * Entrada direta do WhatsApp via Evolution (evento MESSAGES_UPSERT).
 *
 * Confiabilidade (P0):
 * - DEDUPLICAÇÃO pelo id externo da mensagem (key.id): retentativa/reenvio do
 *   provedor não cria lead/mensagem/resposta duplicada (índice único no banco
 *   cobre a corrida entre execuções simultâneas).
 * - O webhook responde em milissegundos; baixar mídia, transcrever, puxar
 *   histórico e rodar o SDR acontecem DEPOIS da resposta (waitUntil) — o
 *   provedor não reenvia por timeout e a IA tem o tempo dela.
 * - Falha no processamento em background vira app_erros (alta) + alerta de
 *   operação; como a mensagem ainda não foi gravada, um reenvio do provedor
 *   reprocessa do zero (nada se perde em silêncio).
 *
 * URL configurada automaticamente pelo app:
 *   /api/whatsapp/inbound?t=<ingest_token do tenant>
 */
export async function POST(req: NextRequest) {
  // Com webhookByEvents=true a Evolution anexa o evento na URL (…?t=TOKEN/messages-upsert).
  const rawT = req.nextUrl.searchParams.get("t") || "";
  const token = (rawT.match(/[a-fA-F0-9]{64}/)?.[0] || rawT).trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  let admin: Admin;
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

  // Dedup ANTES de responder: reenvio do provedor não reprocessa.
  const externalId = String(key?.id || "").trim() || null;
  if (externalId) {
    const { data: dup } = await admin
      .from("app_mensagens")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_message_id", externalId)
      .limit(1)
      .maybeSingle();
    if (dup) return NextResponse.json({ ok: true, ignorado: "duplicada" });
  }

  // Responde já; o trabalho pesado segue em background.
  waitUntil(
    processarInboundWhatsapp(admin, tenantId, instancia, data, externalId).catch((e) =>
      registrarErro({
        tenantId,
        contexto: "whatsapp.inbound.async",
        erro: e,
        severidade: "alta",
      })
    )
  );
  return NextResponse.json({ ok: true, aceito: true });
}

/** Pipeline completo de uma mensagem recebida (roda após a resposta do webhook). */
async function processarInboundWhatsapp(
  admin: Admin,
  tenantId: string,
  instancia: string,
  data: any,
  externalId: string | null
) {
  const key = data?.key ?? {};
  const canalUserId = String(key?.remoteJid || "").replace(/@.*/, "");
  const nome = String(data?.pushName || canalUserId);
  const msg = data?.message ?? {};

  // Detecta lead vindo de anúncio Click-to-WhatsApp (contextInfo.externalAdReply).
  const anuncioRef = (() => {
    const ctxs = [
      msg?.extendedTextMessage?.contextInfo,
      msg?.imageMessage?.contextInfo,
      msg?.videoMessage?.contextInfo,
      msg?.contextInfo,
      data?.contextInfo,
    ];
    for (const c of ctxs) {
      const ad = c?.externalAdReply;
      if (ad) return String(ad.title || ad.sourceId || ad.sourceUrl || "anúncio");
    }
    return null;
  })();

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
    caption = String(
      msg.documentMessage?.caption ||
        msg.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        ""
    );
  } else if (msg?.videoMessage) {
    // Vídeo: sem transcrição por enquanto; usa a legenda se houver.
    caption = String(msg.videoMessage.caption || "");
    texto = texto || caption || "(o cliente enviou um vídeo)";
  }

  let midiaPath: string | null = null;
  if (mediaTipo && instancia) {
    const midia = await baixarMidiaBase64(instancia, data);
    if (midia) {
      // descrição/transcrição para a IA
      const t = await midiaParaTexto(mediaTipo, midia.base64, midia.mime);
      texto = [caption, t].filter(Boolean).join(" — ").trim();
      // guarda o arquivo original para o atendente ver/ouvir
      const ext = midia.mime.includes("png")
        ? "png"
        : midia.mime.includes("webp")
          ? "webp"
          : mediaTipo === "audio"
            ? "ogg"
            : mediaTipo === "documento"
              ? "pdf"
              : "jpg";
      midiaPath = await uploadMidia(
        `${tenantId}/${canalUserId}/${Date.now()}.${ext}`,
        midia.base64,
        midia.mime
      );
    } else if (caption) {
      texto = caption;
    }
  }

  if (!texto) return;

  // Localiza/cria o lead (tenant, whatsapp, canal_user_id).
  type LeadRow = { id: number; atendente_id: string | null };
  let lead: LeadRow | null = null;
  let leadNovo = false;
  {
    const { data: l } = await admin
      .from("app_leads")
      .select("id,atendente_id")
      .eq("tenant_id", tenantId)
      .eq("canal", "whatsapp")
      .eq("canal_user_id", canalUserId)
      .limit(1)
      .maybeSingle();
    lead = l as LeadRow | null;
  }

  if (lead) {
    await admin
      .from("app_leads")
      .update({ ultima_msg: texto, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
  } else {
    const { data: novo, error } = await admin
      .from("app_leads")
      .insert({
        tenant_id: tenantId,
        nome,
        telefone: canalUserId,
        origem: anuncioRef ? "trafego_pago" : "whatsapp",
        aquisicao: anuncioRef ? "pago" : "organico",
        anuncio: anuncioRef,
        canal: "whatsapp",
        canal_user_id: canalUserId,
        temperatura: "frio",
        coluna: "entrada",
        ultima_msg: texto,
      })
      .select("id,atendente_id")
      .single();
    if (error) throw new Error("criar lead: " + error.message);
    lead = novo as LeadRow;
    leadNovo = true;
  }

  // Contato NOVO: puxa o histórico anterior dele ANTES de gravar a mensagem
  // atual (ordem cronológica), para a IA já responder com contexto.
  if (leadNovo && instancia) {
    try {
      await puxarHistoricoContato(tenantId, lead!.id, canalUserId, instancia, texto);
    } catch (e) {
      // best-effort: sem histórico, a IA só começa do zero
      await registrarErro({ tenantId, leadId: lead!.id, contexto: "whatsapp.historico", erro: e });
    }
  }

  const { error: errM } = await admin.from("app_mensagens").insert({
    tenant_id: tenantId,
    lead_id: lead!.id,
    autor: "lead",
    texto,
    midia_url: midiaPath,
    midia_tipo: midiaPath ? mediaTipo : null,
    external_message_id: externalId,
  });
  if (errM) {
    // 23505 = corrida com outra execução do mesmo evento → já processado, para.
    if ((errM as { code?: string }).code === "23505") return;
    throw new Error("gravar mensagem: " + errM.message);
  }

  // Dispara o SDR (ele respeita handoff/agente_ativo e entrega a resposta).
  if (!lead!.atendente_id) {
    try {
      await executarSDR(tenantId, lead!.id);
    } catch (e) {
      await registrarErro({
        tenantId,
        leadId: lead!.id,
        contexto: "whatsapp.inbound",
        erro: e,
        severidade: "alta",
      });
    }
  }
}
