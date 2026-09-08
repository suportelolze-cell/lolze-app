import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { MSG_CONFIRMACAO_PARADA } from "./optout";

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * Aplica o opt-out do contato: tira do funil (coluna 'perdido') e zera o próximo
 * follow-up, o que já faz o cron e o motor de follow-up pararem (ambos ignoram
 * 'perdido'). Envia UMA confirmação, só na primeira vez (não reenvia se o contato
 * repetir "pare"). Best-effort: nunca lança.
 */
export async function pararContato(admin: Admin, tenantId: string, leadId: number): Promise<void> {
  try {
    const { data: atual } = await admin
      .from("app_leads")
      .select("coluna")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const jaParado = ((atual?.coluna as string | null) ?? "") === "perdido";

    await admin
      .from("app_leads")
      .update({ coluna: "perdido", proximo_followup: null, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("tenant_id", tenantId);

    if (!jaParado) {
      try {
        await dispatchOutbound(tenantId, leadId, MSG_CONFIRMACAO_PARADA);
      } catch {
        /* confirmação é best-effort */
      }
    }
  } catch {
    /* nunca derruba o processamento da mensagem */
  }
}
