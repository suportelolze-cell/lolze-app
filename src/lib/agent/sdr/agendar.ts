import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Cria um agendamento no ecossistema (app_agendamentos) e move o lead para
 * 'agendado'. Aparece direto na Agenda do painel daquele cliente.
 * (A sincronização com o Google Calendar é uma 2ª camada — grava google_event_id.)
 */
export async function agendarReuniao(
  tenantId: string,
  leadId: number,
  args: { inicio?: string; duracao_min?: number; servico?: string; nome?: string }
): Promise<string> {
  const inicio = new Date(String(args.inicio ?? ""));
  if (isNaN(inicio.getTime())) {
    return "Erro: data/hora inválida. Confirme o horário com o lead e use ISO 8601 (ex.: 2026-06-21T15:00:00-03:00).";
  }
  const dur = Number(args.duracao_min) > 0 ? Number(args.duracao_min) : 60;
  const fim = new Date(inicio.getTime() + dur * 60000);

  const admin = getCrmAdmin();
  const { data: lead } = await admin
    .from("app_leads")
    .select("nome,telefone,canal")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();

  const { error } = await admin.from("app_agendamentos").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    nome: (args.nome || lead?.nome || "Lead").trim(),
    telefone: lead?.telefone ?? null,
    servico: (args.servico || "Reunião").trim(),
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    status: "confirmado",
    por_ia: true,
    origem: lead?.canal ?? null,
  });
  if (error) return "Erro ao agendar: " + error.message;

  await admin
    .from("app_leads")
    .update({ coluna: "agendado", temperatura: "quente", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);

  const fmt = inicio.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Agendamento criado para ${fmt} (${dur} min) e já visível na Agenda do painel. Confirme o horário com o lead numa frase curta.`;
}
