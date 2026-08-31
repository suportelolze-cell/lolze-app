import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Cliente da Evolution API (WhatsApp) — SERVER-ONLY.
 * Usa EVOLUTION_API_URL + EVOLUTION_API_KEY (sem NEXT_PUBLIC; nunca vão pro
 * browser). Cada tenant tem 1 instância. O app cria a instância sob demanda,
 * busca o QR, consulta o estado e desconecta.
 *
 * Escrito de forma tolerante: a Evolution v2 muda o formato de resposta entre
 * builds, então procuramos o base64/número em vários caminhos possíveis.
 */

export function temEvolutionConfig() {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

function base() {
  return (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
}

async function evo(path: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY || "",
        ...(init?.headers || {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const txt = await res.text();
    let json: any = null;
    try {
      json = txt ? JSON.parse(txt) : null;
    } catch {
      json = { raw: txt };
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

/** Procura um QR base64 em qualquer formato de resposta da Evolution. */
function extrairQr(j: any): string | null {
  if (!j) return null;
  const cand =
    j.base64 ?? j.qrcode?.base64 ?? j.qrcode?.code ?? j.qr?.base64 ?? j.code ?? null;
  if (!cand || typeof cand !== "string") return null;
  // garante o prefixo data: pra renderizar direto no <img>
  return cand.startsWith("data:") ? cand : `data:image/png;base64,${cand}`;
}

/** Procura o número/jid do dono em vários caminhos. */
function extrairNumero(j: any): string | null {
  const raw =
    j?.instance?.owner ??
    j?.instance?.ownerJid ??
    j?.owner ??
    j?.ownerJid ??
    j?.[0]?.ownerJid ??
    j?.[0]?.instance?.owner ??
    null;
  if (!raw || typeof raw !== "string") return null;
  return raw.replace(/@.*/, "");
}

function extrairEstado(j: any): string {
  return (
    j?.instance?.state ?? j?.state ?? j?.instance?.connectionStatus ?? j?.status ?? "close"
  );
}

type SecretRow = {
  evolution_instance: string | null;
  ingest_token: string | null;
};

async function lerSecret(tenantId: string): Promise<SecretRow> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("evolution_instance,ingest_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    evolution_instance: data?.evolution_instance ?? null,
    ingest_token: data?.ingest_token ?? null,
  };
}

/** URL pública do app (Vercel). Fallback no domínio de produção. */
function appBaseUrl() {
  return (process.env.APP_PUBLIC_URL || "https://www.app.lolze.com.br").replace(/\/+$/, "");
}

/** Endpoint de entrada do WhatsApp no próprio app, autenticado pelo token do tenant. */
function appInboundUrl(ingestToken: string) {
  return `${appBaseUrl()}/api/whatsapp/inbound?t=${ingestToken}`;
}

/** Nome determinístico de instância caso o tenant ainda não tenha um. */
function nomePadrao(tenantId: string) {
  return "lolze_" + tenantId.replace(/-/g, "").slice(0, 18);
}

async function salvarInstancia(tenantId: string, instancia: string) {
  const admin = getCrmAdmin();
  await admin
    .from("app_tenant_secrets")
    .upsert(
      { tenant_id: tenantId, evolution_instance: instancia, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
}

async function marcarStatus(tenantId: string, conectado: boolean, numero: string | null) {
  const admin = getCrmAdmin();
  await admin
    .from("app_config")
    .update({
      whatsapp_conectado: conectado,
      whatsapp_numero: numero,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
}

/**
 * Garante que a instância está com o webhook de entrada (n8n) configurado.
 * Best-effort e tolerante a versão: tenta os formatos de body mais comuns da
 * Evolution até um responder OK. Assim o cliente nunca precisa mexer na
 * Evolution na mão.
 */
async function garantirWebhook(instancia: string, url: string) {
  const events = ["MESSAGES_UPSERT"];
  const tentativas: Record<string, unknown>[] = [
    { webhook: { enabled: true, url, webhookByEvents: false, webhookBase64: false, events } },
    { enabled: true, url, webhookByEvents: false, events },
    { url, webhook_by_events: false, events },
  ];
  for (const body of tentativas) {
    const r = await evo(`/webhook/set/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) return true;
  }
  return false;
}

export type ConexaoResultado = {
  ok: boolean;
  conectado: boolean;
  qr?: string | null;
  numero?: string | null;
  erro?: string;
};

/**
 * Garante a instância do tenant e devolve um QR para escanear (ou indica que já
 * está conectado). Cria a instância na primeira vez e configura o webhook de
 * entrada (n8n) se estiver cadastrado no admin.
 */
export async function conectarWhatsapp(tenantId: string): Promise<ConexaoResultado> {
  if (!temEvolutionConfig()) return { ok: false, conectado: false, erro: "Evolution não configurada." };

  const sec = await lerSecret(tenantId);
  let instancia = sec.evolution_instance || nomePadrao(tenantId);

  // Sempre (re)garante o webhook de entrada apontando pro PRÓPRIO app
  // (Opção B: o app recebe direto da Evolution, sem n8n).
  if (sec.ingest_token) await garantirWebhook(instancia, appInboundUrl(sec.ingest_token));

  // Já conectado? então não precisa de QR.
  const est = await evo(`/instance/connectionState/${encodeURIComponent(instancia)}`);
  if (est.ok && extrairEstado(est.json) === "open") {
    const numero = extrairNumero(est.json);
    await marcarStatus(tenantId, true, numero);
    return { ok: true, conectado: true, numero };
  }

  // Cria a instância se ela não existir (404 no connectionState).
  if (est.status === 404 || !est.ok) {
    const body: Record<string, unknown> = {
      instanceName: instancia,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };
    if (sec.ingest_token) {
      body.webhook = {
        url: appInboundUrl(sec.ingest_token),
        enabled: true,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT"],
      };
    }
    const criar = await evo(`/instance/create`, { method: "POST", body: JSON.stringify(body) });
    if (!criar.ok && criar.status !== 403 && criar.status !== 409) {
      // 403/409 = já existe; qualquer outro erro é real
      return {
        ok: false,
        conectado: false,
        erro: criar.json?.message || `Falha ao criar instância (HTTP ${criar.status}).`,
      };
    }
    await salvarInstancia(tenantId, instancia);
    const qr = extrairQr(criar.json);
    if (qr) return { ok: true, conectado: false, qr };
  } else {
    await salvarInstancia(tenantId, instancia);
  }

  // Garante o webhook agora que a instância existe (cobre instância recém-criada).
  if (sec.ingest_token) await garantirWebhook(instancia, appInboundUrl(sec.ingest_token));

  // Pede um QR novo.
  const conn = await evo(`/instance/connect/${encodeURIComponent(instancia)}`);
  const qr = extrairQr(conn.json);
  if (qr) return { ok: true, conectado: false, qr };

  // sem QR e sem estar conectado
  if (extrairEstado(conn.json) === "open") {
    const numero = extrairNumero(conn.json);
    await marcarStatus(tenantId, true, numero);
    return { ok: true, conectado: true, numero };
  }
  return { ok: false, conectado: false, erro: "Não foi possível gerar o QR. Tente de novo." };
}

/** Nome da i-ésima instância de DISPARO (prospecção) do tenant. */
export function nomeDisparo(tenantId: string, i: number) {
  return nomePadrao(tenantId) + "_disp" + i;
}

/**
 * Conecta (QR) uma instância de DISPARO nomeada, dedicada à prospecção.
 * NÃO mexe na instância principal do tenant. O webhook aponta pro mesmo inbound
 * (autenticado pelo ingest_token), então respostas viram lead normalmente.
 */
export async function conectarDisparo(tenantId: string, instancia: string): Promise<ConexaoResultado> {
  if (!temEvolutionConfig()) return { ok: false, conectado: false, erro: "Evolution não configurada." };
  const sec = await lerSecret(tenantId);
  const inbound = sec.ingest_token ? appInboundUrl(sec.ingest_token) : "";
  if (inbound) await garantirWebhook(instancia, inbound);

  const est = await evo(`/instance/connectionState/${encodeURIComponent(instancia)}`);
  if (est.ok && extrairEstado(est.json) === "open") {
    return { ok: true, conectado: true, numero: extrairNumero(est.json) };
  }

  if (est.status === 404 || !est.ok) {
    const body: Record<string, unknown> = {
      instanceName: instancia,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };
    if (inbound) {
      body.webhook = { url: inbound, enabled: true, webhookByEvents: false, events: ["MESSAGES_UPSERT"] };
    }
    const criar = await evo(`/instance/create`, { method: "POST", body: JSON.stringify(body) });
    if (!criar.ok && criar.status !== 403 && criar.status !== 409) {
      return {
        ok: false,
        conectado: false,
        erro: criar.json?.message || `Falha ao criar instância (HTTP ${criar.status}).`,
      };
    }
    const qr = extrairQr(criar.json);
    if (qr) return { ok: true, conectado: false, qr };
  }

  if (inbound) await garantirWebhook(instancia, inbound);
  const conn = await evo(`/instance/connect/${encodeURIComponent(instancia)}`);
  const qr = extrairQr(conn.json);
  if (qr) return { ok: true, conectado: false, qr };
  if (extrairEstado(conn.json) === "open") {
    return { ok: true, conectado: true, numero: extrairNumero(conn.json) };
  }
  return { ok: false, conectado: false, erro: "Não foi possível gerar o QR. Tente de novo." };
}

/** Estado de uma instância de disparo (polling do front). */
export async function statusDisparo(
  instancia: string
): Promise<{ ok: boolean; conectado: boolean; numero?: string | null }> {
  if (!temEvolutionConfig()) return { ok: false, conectado: false };
  const est = await evo(`/instance/connectionState/${encodeURIComponent(instancia)}`);
  if (est.ok && extrairEstado(est.json) === "open") {
    return { ok: true, conectado: true, numero: extrairNumero(est.json) };
  }
  return { ok: true, conectado: false };
}

/** Desconecta e remove uma instância de disparo. */
export async function desconectarDisparo(instancia: string): Promise<{ ok: boolean }> {
  if (!temEvolutionConfig()) return { ok: false };
  await evo(`/instance/logout/${encodeURIComponent(instancia)}`, { method: "DELETE" }).catch(() => null);
  await evo(`/instance/delete/${encodeURIComponent(instancia)}`, { method: "DELETE" }).catch(() => null);
  return { ok: true };
}

/** Consulta o estado atual da conexão (usado no polling do front). */
export async function statusWhatsapp(tenantId: string): Promise<ConexaoResultado> {
  if (!temEvolutionConfig()) return { ok: false, conectado: false, erro: "Evolution não configurada." };
  const sec = await lerSecret(tenantId);
  const instancia = sec.evolution_instance;
  if (!instancia) return { ok: true, conectado: false };

  // (Re)garante o webhook de entrada (app) mesmo com a instância já conectada.
  if (sec.ingest_token) await garantirWebhook(instancia, appInboundUrl(sec.ingest_token));

  const est = await evo(`/instance/connectionState/${encodeURIComponent(instancia)}`);
  const conectado = est.ok && extrairEstado(est.json) === "open";
  let numero: string | null = null;
  if (conectado) {
    numero = extrairNumero(est.json);
    if (!numero) {
      const fi = await evo(`/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`);
      numero = extrairNumero(fi.json);
    }
  }
  await marcarStatus(tenantId, conectado, numero);
  return { ok: true, conectado, numero };
}

/** Envia uma mensagem de texto pela Evolution (tolerante a versão). */
export async function enviarTexto(
  instancia: string,
  numero: string,
  texto: string
): Promise<boolean> {
  const dest = numero.replace(/@.*/, ""); // só os dígitos
  const tentativas: Record<string, unknown>[] = [
    { number: dest, text: texto },
    { number: dest, textMessage: { text: texto } },
    { number: dest, options: { delay: 0, presence: "composing" }, text: texto },
  ];
  for (const body of tentativas) {
    const r = await evo(`/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) return true;
  }
  return false;
}

/**
 * Envia uma mídia pela Evolution a partir de uma URL (a Evolution baixa e
 * reencaminha). Áudio vai por /sendWhatsAppAudio (nota de voz); os demais por
 * /sendMedia. Tolerante a variações de formato entre builds (tenta vários).
 * `tipo` = image | video | document | audio.
 */
export async function enviarMidia(
  instancia: string,
  numero: string,
  opts: {
    tipo: "image" | "video" | "document" | "audio";
    url: string;
    mime?: string;
    caption?: string;
    fileName?: string;
  }
): Promise<boolean> {
  const dest = numero.replace(/@.*/, "");

  if (opts.tipo === "audio") {
    const tentativas: Record<string, unknown>[] = [
      { number: dest, audio: opts.url },
      { number: dest, audioMessage: { audio: opts.url } },
    ];
    for (const body of tentativas) {
      const r = await evo(`/message/sendWhatsAppAudio/${encodeURIComponent(instancia)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (r.ok) return true;
    }
    return false;
  }

  const campos = {
    mediatype: opts.tipo,
    media: opts.url,
    ...(opts.caption ? { caption: opts.caption } : {}),
    ...(opts.fileName ? { fileName: opts.fileName } : {}),
    ...(opts.mime ? { mimetype: opts.mime } : {}),
  };
  const tentativas: Record<string, unknown>[] = [
    { number: dest, ...campos },
    { number: dest, mediaMessage: campos },
  ];
  for (const body of tentativas) {
    const r = await evo(`/message/sendMedia/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) return true;
  }
  return false;
}

/**
 * Baixa a mídia de uma mensagem (áudio/imagem/documento) como base64.
 * Recebe o objeto `message` cru vindo do webhook da Evolution.
 */
export async function baixarMidiaBase64(
  instancia: string,
  message: unknown
): Promise<{ base64: string; mime: string } | null> {
  const tentativas: Record<string, unknown>[] = [
    { message },
    { message, convertToMp4: false },
  ];
  for (const body of tentativas) {
    const r = await evo(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const base64 = r.json?.base64 ?? r.json?.media ?? r.json?.buffer ?? null;
      const mime = r.json?.mimetype ?? r.json?.mimeType ?? "";
      if (base64 && typeof base64 === "string") return { base64, mime };
    }
  }
  return null;
}

/** Sobe uma mídia (base64) para o bucket 'midias'. Devolve o caminho salvo. */
export async function uploadMidia(
  path: string,
  base64: string,
  mime: string
): Promise<string | null> {
  try {
    const admin = getCrmAdmin();
    const buf = Buffer.from(base64, "base64");
    const { error } = await admin.storage
      .from("midias")
      .upload(path, buf, { contentType: mime || "application/octet-stream", upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

// Cache de URLs assinadas por caminho. A assinatura muda a cada chamada de
// createSignedUrls; sem cache, cada poll (8s) trocaria o `src` da mídia e
// reiniciaria vídeo/áudio (e re-baixaria imagens). Reusa a MESMA URL enquanto
// válida, para o elemento <video>/<audio> não recarregar.
const TTL_ASSINATURA_S = 3600; // 1h de validade da URL
const REUSAR_ATE_MS = 55 * 60 * 1000; // reusa até 55min (margem antes de expirar)
const _cacheMidiaUrl = new Map<string, { url: string; exp: number }>();

/** Gera (e cacheia) URLs assinadas para caminhos do bucket 'midias'. */
export async function urlsAssinadasMidia(paths: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (paths.length === 0) return mapa;

  const agora = Date.now();
  const faltando: string[] = [];
  for (const p of paths) {
    const c = _cacheMidiaUrl.get(p);
    if (c && c.exp > agora) mapa.set(p, c.url);
    else faltando.push(p);
  }
  if (faltando.length === 0) return mapa;

  try {
    const admin = getCrmAdmin();
    const { data } = await admin.storage.from("midias").createSignedUrls(faltando, TTL_ASSINATURA_S);
    (data ?? []).forEach((d) => {
      if (d.path && d.signedUrl) {
        _cacheMidiaUrl.set(d.path, { url: d.signedUrl, exp: agora + REUSAR_ATE_MS });
        mapa.set(d.path, d.signedUrl);
      }
    });
  } catch {
    /* best-effort */
  }
  return mapa;
}

/** Tipo de mídia de uma mensagem crua da Evolution (null se for só texto). */
function tipoMidiaMsg(m: any): "imagem" | "audio" | "documento" | "video" | null {
  const msg = m?.message ?? m ?? {};
  if (msg.imageMessage) return "imagem";
  if (msg.audioMessage) return "audio";
  if (msg.videoMessage) return "video";
  if (msg.documentMessage) return "documento";
  return null;
}

/**
 * Extrai o texto de uma mensagem crua da Evolution (vários formatos). Mensagem
 * de mídia SEM legenda vira um marcador ("[imagem]" etc.) em vez de ficar vazia
 * — assim ela NÃO é descartada na importação (o arquivo em si é baixado à parte).
 */
function extrairTextoMsg(m: any): string {
  const msg = m?.message ?? m ?? {};
  if (msg.conversation) return String(msg.conversation).trim();
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text).trim();
  const cap = (k: string) => {
    const c = msg[k]?.caption ? String(msg[k].caption).trim() : "";
    return c ? c + " " : "";
  };
  if (msg.imageMessage) return (cap("imageMessage") + "[imagem]").trim();
  if (msg.videoMessage) return (cap("videoMessage") + "[vídeo]").trim();
  if (msg.documentMessage) {
    const nome = msg.documentMessage?.fileName ? ` ${msg.documentMessage.fileName}` : "";
    return (cap("documentMessage") + "[documento" + nome + "]").trim();
  }
  if (msg.audioMessage) return "[áudio]";
  if (msg.stickerMessage) return "[figurinha]";
  return "";
}

/** Lista os chats individuais da instância (tolerante a versão). Reporta o erro
 * real da API quando nenhuma tentativa retorna a lista (para diagnóstico). */
async function buscarChats(
  instancia: string
): Promise<{ chats: { jid: string; nome: string }[]; erroApi?: string }> {
  const tentativas: (RequestInit | undefined)[] = [
    { method: "POST", body: JSON.stringify({}) },
    { method: "POST", body: JSON.stringify({ where: {} }) },
    undefined, // GET
  ];
  let ultimoStatus = 0;
  for (const init of tentativas) {
    const r = await evo(`/chat/findChats/${encodeURIComponent(instancia)}`, init);
    ultimoStatus = r.status ?? 0;
    const arr: any[] | null = Array.isArray(r.json)
      ? r.json
      : Array.isArray(r.json?.chats)
        ? r.json.chats
        : Array.isArray(r.json?.records)
          ? r.json.records
          : null;
    if (r.ok && arr) {
      return {
        chats: arr
          .map((c: any) => ({
            jid: c.remoteJid || c.id || c.jid || c.chatId || "",
            nome: c.pushName || c.name || c.subject || c.contact?.pushName || "",
          }))
          .filter((c) => typeof c.jid === "string" && c.jid.endsWith("@s.whatsapp.net")), // só pessoas, não grupos
      };
    }
  }
  return {
    chats: [],
    erroApi: `A API do WhatsApp não retornou as conversas (findChats, status ${ultimoStatus || "sem resposta"}).`,
  };
}

type MsgHistorico = {
  fromMe: boolean;
  texto: string;
  ts: number;
  raw: any;
  midiaTipo: "imagem" | "audio" | "documento" | "video" | null;
};

/** Busca as últimas mensagens de um chat (tolerante a versão). Mantém mídia
 * (não descarta mensagem sem legenda) e carrega a mensagem crua para o download. */
async function buscarMensagens(instancia: string, jid: string, limite: number): Promise<MsgHistorico[]> {
  const bodies = [
    { where: { key: { remoteJid: jid } }, limit: limite },
    { where: { remoteJid: jid }, limit: limite },
    { where: { key: { remoteJid: jid } } },
    { where: { remoteJid: jid } },
  ];
  for (const body of bodies) {
    const r = await evo(`/chat/findMessages/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    let arr: any[] | null = null;
    if (r.ok) {
      if (Array.isArray(r.json)) arr = r.json;
      else if (Array.isArray(r.json?.messages?.records)) arr = r.json.messages.records;
      else if (Array.isArray(r.json?.messages)) arr = r.json.messages;
      else if (Array.isArray(r.json?.records)) arr = r.json.records;
    }
    if (arr) {
      return arr
        .map((m: any) => ({
          fromMe: Boolean(m.key?.fromMe ?? m.fromMe),
          texto: extrairTextoMsg(m),
          ts: Number(m.messageTimestamp ?? m.timestamp ?? 0),
          raw: m,
          midiaTipo: tipoMidiaMsg(m),
        }))
        .filter((m) => m.texto) // mídia agora tem marcador, então não some
        .sort((a, b) => a.ts - b.ts)
        .slice(-limite);
    }
  }
  return [];
}

export type ImportResultado = { ok: boolean; contatos: number; mensagens: number; erro?: string };

/**
 * Importa o histórico recente de conversas do WhatsApp conectado para o app:
 * cada chat vira um lead (Caixa de Entrada) e as mensagens entram no histórico,
 * para a IA já ter contexto. Best-effort, limitado para não estourar o tempo.
 * NÃO dispara a IA — ela só responde quando o contato escrever de novo.
 */
export async function importarHistoricoWhatsapp(tenantId: string): Promise<ImportResultado> {
  if (!temEvolutionConfig()) return { ok: false, contatos: 0, mensagens: 0, erro: "Evolution não configurada." };
  const sec = await lerSecret(tenantId);
  const instancia = sec.evolution_instance;
  if (!instancia) return { ok: false, contatos: 0, mensagens: 0, erro: "WhatsApp não conectado." };

  const admin = getCrmAdmin();
  const { chats: todosChats, erroApi } = await buscarChats(instancia);
  if (erroApi) return { ok: false, contatos: 0, mensagens: 0, erro: erroApi };
  const chats = todosChats.slice(0, 60);
  if (chats.length === 0)
    return { ok: false, contatos: 0, mensagens: 0, erro: "Nenhuma conversa encontrada (o WhatsApp sincroniza só o histórico recente)." };

  const MAX_MIDIA = 60; // teto de arquivos baixados por import (evita estourar o tempo)
  let contatos = 0;
  let mensagens = 0;
  let midiasBaixadas = 0;
  let chatsComMsg = 0;
  for (const c of chats) {
    const numero = c.jid.replace(/@.*/, "");
    if (!numero) continue;

    // Lead por (tenant, canal, canal_user_id): pega o existente ou cria.
    let leadId: number | null = null;
    const { data: ex } = await admin
      .from("app_leads")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("canal", "whatsapp")
      .eq("canal_user_id", numero)
      .maybeSingle();
    if (ex?.id) {
      leadId = ex.id as number;
    } else {
      const { data: novo } = await admin
        .from("app_leads")
        .insert({
          tenant_id: tenantId,
          canal: "whatsapp",
          canal_user_id: numero,
          telefone: numero,
          nome: c.nome || numero,
          coluna: "entrada",
          temperatura: "morno",
        })
        .select("id")
        .single();
      leadId = (novo?.id as number) ?? null;
      if (leadId) contatos++;
    }
    if (!leadId) continue;

    // Não reimporta por cima de quem já tem histórico/conversa viva.
    const { count } = await admin
      .from("app_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId);
    if ((count ?? 0) > 0) continue;

    const msgs = await buscarMensagens(instancia, c.jid, 100);
    if (msgs.length > 0) chatsComMsg++;

    const rows: Record<string, unknown>[] = [];
    for (const m of msgs) {
      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        lead_id: leadId,
        autor: m.fromMe ? "atendente" : "lead",
        texto: m.texto,
      };
      // Baixa e guarda a mídia real (imagem/áudio/documento), até o teto. Vídeo
      // fica só com o marcador. Best-effort: falha no download não perde a mensagem.
      if (m.midiaTipo && m.midiaTipo !== "video" && midiasBaixadas < MAX_MIDIA) {
        try {
          const mid = await baixarMidiaBase64(instancia, m.raw);
          if (mid?.base64) {
            const ext = mid.mime.includes("png")
              ? "png"
              : mid.mime.includes("webp")
                ? "webp"
                : m.midiaTipo === "audio"
                  ? "ogg"
                  : m.midiaTipo === "documento"
                    ? "pdf"
                    : "jpg";
            const path = await uploadMidia(
              `${tenantId}/${numero}/${m.ts || Date.now()}-${midiasBaixadas}.${ext}`,
              mid.base64,
              mid.mime
            );
            if (path) {
              row.midia_url = path;
              row.midia_tipo = m.midiaTipo;
              midiasBaixadas++;
            }
          }
        } catch {
          /* best-effort: fica só o marcador de texto */
        }
      }
      rows.push(row);
    }

    if (rows.length > 0) {
      const { error } = await admin.from("app_mensagens").insert(rows);
      if (!error) mensagens += rows.length;
    }
  }

  // Achou conversas mas nenhuma mensagem veio: sinaliza (em vez de "ok" mudo com 0).
  if (mensagens === 0 && chatsComMsg === 0 && chats.length > 0) {
    return {
      ok: false,
      contatos,
      mensagens: 0,
      erro: "Encontrei suas conversas, mas a API do WhatsApp não devolveu as mensagens (pode ser a versão da integração). Nada foi importado.",
    };
  }

  return { ok: true, contatos, mensagens };
}

/**
 * Puxa o histórico ANTERIOR de UM contato (chamado no 1º inbound de um lead
 * novo) e insere no app, para a IA já responder com contexto. Idempotente:
 * só roda se o lead ainda não tem mensagens. `excluirTexto` evita duplicar a
 * mensagem que acabou de chegar (ela é inserida pelo webhook em seguida).
 */
export async function puxarHistoricoContato(
  tenantId: string,
  leadId: number,
  numero: string,
  instancia: string,
  excluirTexto?: string
): Promise<number> {
  const admin = getCrmAdmin();
  const { count } = await admin
    .from("app_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("lead_id", leadId);
  if ((count ?? 0) > 0) return 0; // já tem histórico — não mexe

  const msgs = await buscarMensagens(instancia, `${numero}@s.whatsapp.net`, 20);
  const rows = msgs.map((m) => ({
    tenant_id: tenantId,
    lead_id: leadId,
    autor: m.fromMe ? "atendente" : "lead",
    texto: m.texto,
  }));
  // remove a última mensagem do lead igual à que acabou de chegar (anti-duplicata)
  if (excluirTexto) {
    const alvo = excluirTexto.trim();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].autor === "lead" && rows[i].texto === alvo) {
        rows.splice(i, 1);
        break;
      }
    }
  }
  if (rows.length === 0) return 0;
  const { error } = await admin.from("app_mensagens").insert(rows);
  return error ? 0 : rows.length;
}

/** Desconecta (logout) a instância do WhatsApp do tenant. */
export async function desconectarWhatsapp(tenantId: string): Promise<{ ok: boolean; erro?: string }> {
  if (!temEvolutionConfig()) return { ok: false, erro: "Evolution não configurada." };
  const sec = await lerSecret(tenantId);
  const instancia = sec.evolution_instance;
  if (!instancia) return { ok: true };
  await evo(`/instance/logout/${encodeURIComponent(instancia)}`, { method: "DELETE" });
  await marcarStatus(tenantId, false, null);
  return { ok: true };
}
