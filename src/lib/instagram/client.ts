import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Cliente do Instagram (Graph API da Meta) — SERVER-ONLY.
 * Um App da Meta atende todos os clientes; cada tenant guarda o ID da conta
 * IG Business e o token da Página para enviar/receber.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/** Resolve o tenant pelo ID da conta IG que recebeu a mensagem. */
export async function tenantPorContaIg(igAccountId: string): Promise<string | null> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .eq("ig_account_id", igAccountId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

/** Token da Página do tenant (para enviar respostas no IG). */
export async function tokenIg(tenantId: string): Promise<string | null> {
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("ig_access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data?.ig_access_token ?? null;
}

/** Envia uma mensagem de texto pelo Instagram (Graph API). */
export async function enviarTextoIg(
  token: string,
  destinatarioId: string,
  texto: string
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: destinatarioId },
        message: { text: texto },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
