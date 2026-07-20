import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Ledger de eventos do funil — fatos IMUTÁVEIS para análise (o snapshot
 * operacional continua em app_leads). Alimenta conversão por coorte,
 * atribuição de receita e a tela "Hoje"/Resultados.
 *
 * Best-effort deliberado: registrar um evento NUNCA pode quebrar o fluxo de
 * negócio que o originou. Eventos one-shot (lead_received, first_response_sent,
 * qualified, handoff_requested, sale_won) são deduplicados pelo índice único —
 * a segunda gravação é silenciosamente ignorada, então os call sites não
 * precisam checar "já registrei?".
 */

export type TipoEvento =
  | "lead_received"
  | "first_response_sent"
  | "qualified"
  | "handoff_requested"
  | "appointment_booked"
  | "appointment_attended"
  | "sale_won"
  | "revenue_confirmed"
  | "lead_reactivated";

export async function registrarEvento(e: {
  tenantId: string;
  leadId?: number | null;
  tipo: TipoEvento;
  canal?: string | null;
  origem?: string | null;
  valorCents?: number | null;
  dados?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = getCrmAdmin();
    const { error } = await admin.from("app_eventos").insert({
      tenant_id: e.tenantId,
      lead_id: e.leadId ?? null,
      tipo: e.tipo,
      canal: e.canal ?? null,
      origem: e.origem ?? null,
      valor_cents: e.valorCents ?? null,
      dados: e.dados ?? {},
    });
    // 23505 = one-shot já registrado (esperado); qualquer outro erro é engolido
    // de propósito — o ledger é observação, não fluxo de negócio.
    void error;
  } catch {
    /* best-effort */
  }
}
