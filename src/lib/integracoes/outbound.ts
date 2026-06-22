import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";
import { enviarTextoIg } from "@/lib/instagram/client";

/**
 * Saída: entrega a resposta do SDR ao contato no canal de origem.
 * - WhatsApp → Evolution (direto)
 * - Instagram → Graph API da Meta
 * Best-effort: se não houver config, a mensagem fica só registrada no painel.
 */
export async function dispatchOutbound(tenantId: string, leadId: number, texto: string) {
  try {
    const admin = getCrmAdmin();

    const { data: lead } = await admin
      .from("app_leads")
      .select("canal,canal_user_id,telefone")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lead) return;

    const canal = lead.canal || "whatsapp";
    const destino = lead.canal_user_id || lead.telefone || "";
    if (!destino) return;

    const { data: sec } = await admin
      .from("app_tenant_secrets")
      .select("evolution_instance,ig_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (canal === "whatsapp" && temEvolutionConfig() && sec?.evolution_instance) {
      await enviarTexto(sec.evolution_instance, destino, texto);
    } else if (canal === "instagram" && sec?.ig_access_token) {
      await enviarTextoIg(sec.ig_access_token, destino, texto);
    }
  } catch {
    // entrega é best-effort; falha aqui não invalida a mensagem já salva
  }
}
