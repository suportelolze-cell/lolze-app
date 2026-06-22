import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";

/**
 * Saída: entrega a resposta do SDR ao contato pelo WhatsApp, DIRETO pela
 * Evolution (sem n8n). Best-effort: se não houver instância/config, a mensagem
 * fica registrada no painel mas não é enviada.
 */
export async function dispatchOutbound(tenantId: string, leadId: number, texto: string) {
  try {
    if (!temEvolutionConfig()) return;
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
    if (canal !== "whatsapp" || !destino) return; // só WhatsApp por enquanto

    const { data: sec } = await admin
      .from("app_tenant_secrets")
      .select("evolution_instance")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (sec?.evolution_instance) {
      await enviarTexto(sec.evolution_instance, destino, texto);
    }
  } catch {
    // entrega é best-effort; falha aqui não invalida a mensagem já salva
  }
}
