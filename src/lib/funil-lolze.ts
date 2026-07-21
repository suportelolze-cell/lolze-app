import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Funil da PRÓPRIA Lolze (dossiê P1.4): eventos internos da jornada
 * landing → diagnóstico → demo → aplicação → cadastro → checkout →
 * pagamento → ativação. Best-effort: nunca quebra o fluxo que o originou.
 */

export type EventoFunilLolze =
  | "diagnostico_interagido"
  | "demo_mensagem"
  | "aplicacao_enviada"
  | "cadastro_criado"
  | "checkout_iniciado"
  | "pagamento_confirmado"
  | "onboarding_concluido";

export async function registrarFunilLolze(
  evento: EventoFunilLolze,
  dados: Record<string, unknown> = {}
): Promise<void> {
  try {
    const admin = getCrmAdmin();
    await admin.from("app_funil_lolze").insert({ evento, dados });
  } catch {
    /* best-effort */
  }
}
