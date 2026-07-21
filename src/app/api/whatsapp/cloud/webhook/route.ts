import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";
import {
  tenantPorPhoneNumberId,
  credenciaisWaCloud,
  baixarMidiaWaCloud,
} from "@/lib/whatsapp/cloud";
import { uploadMidia } from "@/lib/evolution/client";
import { midiaParaTexto, type TipoMidia } from "@/lib/evolution/media";
import { registrarErro } from "@/lib/observability/erros";
import { registrarEvento } from "@/lib/eventos";
import { resolverLead, vincularIdentidade } from "@/lib/identidade";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // teto do processamento em background (waitUntil)

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * Webhook da API OFICIAL do WhatsApp (Cloud API da Meta).
 *
 * GET  → verificação do webhook (hub.challenge) na configuração do App da Meta.
 * POST → mensagens recebidas e RECIBOS de entrega (statuses):
 *        valida a assinatura da Meta, deduplica pelo wamid, responde 200
 *        imediatamente e processa em background (lead + mídia + SDR).
 *        Recibos sent/delivered/read/failed atualizam o status das mensagens
 *        ENVIADAS (casadas pelo wamid gravado no envio).
 *
 * Configure no App da Meta (produto WhatsApp → Configuração → Webhooks):
 *   URL de callback:  https://www.app.lolze.com.br/api/whatsapp/cloud/webhook
 *   Verificar token:  o valor de META_WHATSAPP_VERIFY_TOKEN (env da Vercel)
 *   Campos assinados: messages
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge") ?? "";
  const esperado = (process.env.META_WHATSAPP_VERIFY_TOKEN || "").trim();
  if (mode === "subscribe" && esperado && token === esperado) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Assinatura da Meta (X-Hub-Signature-256 = HMAC-SHA256 do corpo com o App
  // Secret). Exigida quando META_APP_SECRET está configurado.
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
    processarEntradasWaCloud(admin, entries).catch((e) =>
      registrarErro({ contexto: "whatsapp.cloud.async", erro: e, severidade: "alta" })
    )
  );
  return NextResponse.json({ ok: true });
}

/** Hierarquia de status: um recibo nunca REBAIXA o estado da mensagem. */
const STATUS_ANTERIORES: Record<string, string[]> = {
  enviada: ["pendente"],
  entregue: ["pendente", "enviada"],
  lida: ["pendente", "enviada", "entregue"],
};

async function processarEntradasWaCloud(admin: Admin, entries: any[]) {
  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field !== "messages") continue;
      const value = ch?.value ?? {};
      const phoneNumberId = String(value?.metadata?.phone_number_id || "");
      if (!phoneNumberId) continue;

      const tenantId = await tenantPorPhoneNumberId(phoneNumberId);
      if (!tenantId) continue; // número não vinculado a nenhum cliente

      // 1) Recibos de entrega das mensagens que NÓS enviamos.
      const statuses: any[] = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const st of statuses) {
        await aplicarStatus(admin, tenantId, st);
      }

      // 2) Mensagens recebidas do lead.
      const contatos: any[] = Array.isArray(value?.contacts) ? value.contacts : [];
      const nomePorWaId = new Map<string, string>(
        contatos.map((c: any) => [String(c?.wa_id || ""), String(c?.profile?.name || "")])
      );
      const mensagens: any[] = Array.isArray(value?.messages) ? value.messages : [];
      for (const msg of mensagens) {
        try {
          await processarMensagemWaCloud(admin, tenantId, msg, nomePorWaId);
        } catch (e) {
          await registrarErro({
            tenantId,
            contexto: "whatsapp.cloud.mensagem",
            erro: e,
            severidade: "alta",
          });
        }
      }
    }
  }
}

/** Atualiza o status de uma mensagem enviada (casada pelo wamid). */
async function aplicarStatus(admin: Admin, tenantId: string, st: any) {
  const wamid = String(st?.id || "").trim();
  const tipo = String(st?.status || "").trim(); // sent | delivered | read | failed
  if (!wamid || !tipo) return;

  if (tipo === "failed") {
    const motivo =
      (Array.isArray(st?.errors) && st.errors[0]?.message) || "falha reportada pelo WhatsApp";
    await admin
      .from("app_mensagens")
      .update({ status: "falhou", ultimo_erro: String(motivo) })
      .eq("tenant_id", tenantId)
      .eq("external_message_id", wamid);
    await registrarErro({
      tenantId,
      contexto: "outbound.whatsapp.cloud",
      erro: `WhatsApp reportou falha de entrega: ${motivo}`,
      severidade: "alta",
    });
    return;
  }

  const mapa: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida" };
  const novo = mapa[tipo];
  if (!novo) return;
  await admin
    .from("app_mensagens")
    .update({ status: novo })
    .eq("tenant_id", tenantId)
    .eq("external_message_id", wamid)
    .in("status", STATUS_ANTERIORES[novo]);
}

/** Pipeline de UMA mensagem recebida: dedup, mídia, lead, gravação e SDR. */
async function processarMensagemWaCloud(
  admin: Admin,
  tenantId: string,
  msg: any,
  nomePorWaId: Map<string, string>
) {
  const wamid = String(msg?.id || "").trim() || null;
  const de = String(msg?.from || "").replace(/\D/g, "");
  if (!de) return;

  // Dedup pelo wamid (reenvio do webhook não duplica; índice único cobre corrida).
  if (wamid) {
    const { data: dup } = await admin
      .from("app_mensagens")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_message_id", wamid)
      .limit(1)
      .maybeSingle();
    if (dup) return;
  }

  // Texto direto ou mídia a baixar/transcrever (mesmo pipeline da Evolution).
  const tipo = String(msg?.type || "");
  let texto = "";
  let mediaTipo: TipoMidia | null = null;
  let mediaId = "";
  let caption = "";

  if (tipo === "text") {
    texto = String(msg?.text?.body || "").trim();
  } else if (tipo === "audio") {
    mediaTipo = "audio";
    mediaId = String(msg?.audio?.id || "");
  } else if (tipo === "image") {
    mediaTipo = "imagem";
    mediaId = String(msg?.image?.id || "");
    caption = String(msg?.image?.caption || "");
  } else if (tipo === "document") {
    mediaTipo = "documento";
    mediaId = String(msg?.document?.id || "");
    caption = String(msg?.document?.caption || "");
  } else if (tipo === "video") {
    caption = String(msg?.video?.caption || "");
    texto = caption || "(o cliente enviou um vídeo)";
  } else if (tipo === "button" || tipo === "interactive") {
    texto = String(
      msg?.button?.text || msg?.interactive?.button_reply?.title || msg?.interactive?.list_reply?.title || ""
    ).trim();
  }

  let midiaPath: string | null = null;
  if (mediaTipo && mediaId) {
    const cred = await credenciaisWaCloud(tenantId);
    const midia = cred ? await baixarMidiaWaCloud(cred, mediaId) : null;
    if (midia) {
      const t = await midiaParaTexto(mediaTipo, midia.base64, midia.mime);
      texto = [caption, t].filter(Boolean).join(" — ").trim();
      const ext = midia.mime.includes("png")
        ? "png"
        : midia.mime.includes("webp")
          ? "webp"
          : mediaTipo === "audio"
            ? "ogg"
            : mediaTipo === "documento"
              ? "pdf"
              : "jpg";
      midiaPath = await uploadMidia(`${tenantId}/${de}/${Date.now()}.${ext}`, midia.base64, midia.mime);
    } else if (caption) {
      texto = caption;
    }
  }

  if (!texto) return;

  // Resolve o lead pela IDENTIDADE de canal (unifica com lead de mesmo telefone).
  const nome = nomePorWaId.get(de) || de;
  let lead = await resolverLead(admin, tenantId, "whatsapp", de);

  if (lead) {
    await admin
      .from("app_leads")
      .update({
        ultima_msg: texto,
        updated_at: new Date().toISOString(),
        canal: "whatsapp",
        canal_user_id: de,
      })
      .eq("id", lead.id);
    if (lead.followup_modo === "reativacao") {
      await registrarEvento({
        tenantId,
        leadId: lead.id,
        tipo: "lead_reactivated",
        canal: "whatsapp",
        dados: { modo: "automatico" },
      });
    }
  } else {
    const { data: novo, error } = await admin
      .from("app_leads")
      .insert({
        tenant_id: tenantId,
        nome,
        telefone: de,
        origem: "whatsapp",
        canal: "whatsapp",
        canal_user_id: de,
        temperatura: "frio",
        coluna: "entrada",
        ultima_msg: texto,
      })
      .select("id,atendente_id")
      .single();
    if (error) throw new Error("criar lead: " + error.message);
    lead = { ...(novo as { id: number; atendente_id: string | null }), followup_modo: null };
    await vincularIdentidade(admin, tenantId, lead.id, "whatsapp", de);
    await registrarEvento({
      tenantId,
      leadId: lead.id,
      tipo: "lead_received",
      canal: "whatsapp",
      origem: "whatsapp",
    });
  }

  const { error: errM } = await admin.from("app_mensagens").insert({
    tenant_id: tenantId,
    lead_id: lead!.id,
    autor: "lead",
    texto,
    midia_url: midiaPath,
    midia_tipo: midiaPath ? mediaTipo : null,
    external_message_id: wamid,
  });
  if (errM) {
    if ((errM as { code?: string }).code === "23505") return; // corrida: já processada
    throw new Error("gravar mensagem: " + errM.message);
  }

  if (!lead!.atendente_id) {
    try {
      await executarSDR(tenantId, lead!.id);
    } catch (e) {
      await registrarErro({
        tenantId,
        leadId: lead!.id,
        contexto: "whatsapp.cloud.sdr",
        erro: e,
        severidade: "alta",
      });
    }
  }
}
