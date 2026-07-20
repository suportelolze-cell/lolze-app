import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Cliente da API oficial do WhatsApp (Cloud API da Meta) — SERVER-ONLY.
 *
 * Um App da Meta atende todos os clientes; cada tenant guarda o
 * `wa_phone_number_id` (roteia o webhook) e o `wa_access_token` (envia).
 * Convive com a Evolution: o dispatchOutbound prefere a Cloud API quando o
 * tenant tem credenciais e cai para a Evolution caso contrário.
 */

function graphBase() {
  const v = (process.env.META_GRAPH_API_VERSION || "v21.0").trim().replace(/^\/+|\/+$/g, "");
  return `https://graph.facebook.com/${v}`;
}

/** Resolve o tenant pelo phone_number_id que recebeu a mensagem. */
export async function tenantPorPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .eq("wa_phone_number_id", phoneNumberId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

export type CredenciaisWaCloud = { phoneNumberId: string; accessToken: string };

/** Credenciais da Cloud API do tenant (null = tenant ainda usa Evolution). */
export async function credenciaisWaCloud(tenantId: string): Promise<CredenciaisWaCloud | null> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("wa_phone_number_id,wa_access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const phoneNumberId = (data?.wa_phone_number_id as string | null)?.trim() ?? "";
  const accessToken = (data?.wa_access_token as string | null)?.trim() ?? "";
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

/**
 * Envia texto pela Cloud API. Devolve o wamid da mensagem (para casar com os
 * recibos de status: sent → delivered → read) ou null em falha.
 */
export async function enviarTextoWaCloud(
  cred: CredenciaisWaCloud,
  para: string,
  texto: string
): Promise<{ ok: boolean; wamid: string | null; erro?: string }> {
  try {
    const res = await fetch(`${graphBase()}/${encodeURIComponent(cred.phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: para.replace(/\D/g, ""),
        type: "text",
        text: { body: texto },
      }),
      cache: "no-store",
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, wamid: null, erro: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, wamid: json?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { ok: false, wamid: null, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Baixa uma mídia recebida (áudio/imagem/documento) como base64.
 * Cloud API: GET /{media_id} devolve a URL temporária; o download exige o token.
 */
export async function baixarMidiaWaCloud(
  cred: CredenciaisWaCloud,
  mediaId: string
): Promise<{ base64: string; mime: string } | null> {
  try {
    const meta = await fetch(`${graphBase()}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${cred.accessToken}` },
      cache: "no-store",
    });
    const info: any = await meta.json().catch(() => null);
    const url = info?.url;
    if (!meta.ok || !url) return null;

    const arq = await fetch(url, {
      headers: { Authorization: `Bearer ${cred.accessToken}` },
      cache: "no-store",
    });
    if (!arq.ok) return null;
    const buf = Buffer.from(await arq.arrayBuffer());
    return { base64: buf.toString("base64"), mime: info?.mime_type || "" };
  } catch {
    return null;
  }
}
