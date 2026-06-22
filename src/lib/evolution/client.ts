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
  n8n_inbound_url: string | null;
};

async function lerSecret(tenantId: string): Promise<SecretRow> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("evolution_instance,n8n_inbound_url")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    evolution_instance: data?.evolution_instance ?? null,
    n8n_inbound_url: data?.n8n_inbound_url ?? null,
  };
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

  // Sempre (re)garante o webhook de entrada na instância, mesmo se ela já
  // existir/estiver conectada — é o que faz as mensagens recebidas fluírem.
  if (sec.n8n_inbound_url) await garantirWebhook(instancia, sec.n8n_inbound_url);

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
    if (sec.n8n_inbound_url) {
      body.webhook = {
        url: sec.n8n_inbound_url,
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

/** Consulta o estado atual da conexão (usado no polling do front). */
export async function statusWhatsapp(tenantId: string): Promise<ConexaoResultado> {
  if (!temEvolutionConfig()) return { ok: false, conectado: false, erro: "Evolution não configurada." };
  const sec = await lerSecret(tenantId);
  const instancia = sec.evolution_instance;
  if (!instancia) return { ok: true, conectado: false };

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
