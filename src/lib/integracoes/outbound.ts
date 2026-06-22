import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";

/**
 * Saída: entrega a resposta do SDR ao contato.
 * - WhatsApp (Opção B): envia DIRETO pela Evolution, sem n8n.
 * - Outros canais (ou WhatsApp sem instância): cai no webhook do canal (n8n).
 * Best-effort: nunca derruba o registro local.
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
    const destino = lead.canal_user_id || lead.telefone || "";

    // WhatsApp direto pela Evolution (caminho preferido).
    if (canal === "whatsapp" && destino && temEvolutionConfig()) {
      const { data: sec } = await admin
        .from("app_tenant_secrets")
        .select("evolution_instance")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (sec?.evolution_instance) {
        const ok = await enviarTexto(sec.evolution_instance, destino, texto);
        if (ok) return; // entregue; não precisa do webhook
      }
    }

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
