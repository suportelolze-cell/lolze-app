import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Saída: quando o SDR responde no painel, entrega a mensagem ao n8n do cliente
 * (webhook do canal) para ser enviada ao contato. Best-effort: nunca derruba o
 * envio local; se não houver webhook configurado, apenas registra no banco.
 */
export async function dispatchOutbound(tenantId: string, leadId: number, texto: string) {
  try {
    const admin = getCrmAdmin();

    const { data: lead } = await admin
      .from("app_leads")
      .select("canal,canal_user_id,telefone,nome")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lead) return;

    const canal = lead.canal || "whatsapp";
    const { data: wh } = await admin
      .from("app_channel_webhooks")
      .select("url")
      .eq("tenant_id", tenantId)
      .eq("canal", canal)
      .maybeSingle();

    const url = (wh?.url ?? "").trim();
    if (!url) return; // sem webhook do canal: só fica registrado no painel

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canal,
          texto,
          autor: "atendente",
          lead: {
            id: leadId,
            nome: lead.nome,
            telefone: lead.telefone,
            canal_user_id: lead.canal_user_id,
          },
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  } catch {
    // entrega é best-effort; falha aqui não invalida a mensagem já salva
  }
}
