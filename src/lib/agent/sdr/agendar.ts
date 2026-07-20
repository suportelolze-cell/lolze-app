import { getCrmAdmin } from "@/lib/supabase/admin";
import { criarEventoGoogle, horarioOcupadoGoogle } from "@/lib/google/calendar";
import { registrarEvento } from "@/lib/eventos";

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

  const nome = (args.nome || lead?.nome || "Lead").trim();
  const servico = (args.servico || "Reunião").trim();

  // Não marca em cima de outro agendamento do app...
  const { data: choque } = await admin
    .from("app_agendamentos")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelado")
    .lt("inicio", fim.toISOString())
    .gt("fim", inicio.toISOString())
    .limit(1);
  if (choque && choque.length > 0)
    return "Esse horário já está ocupado na agenda. Ofereça outro horário ao lead e tente novamente.";

  // ...nem em cima de um compromisso que já existe no Google Calendar do cliente.
  if (await horarioOcupadoGoogle(tenantId, inicio.toISOString(), fim.toISOString()))
    return "Esse horário está ocupado no Google Calendar do cliente. Ofereça outro horário ao lead.";

  const { data: novo, error } = await admin
    .from("app_agendamentos")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      nome,
      telefone: lead?.telefone ?? null,
      servico,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      status: "confirmado",
      por_ia: true,
      origem: lead?.canal ?? null,
    })
    .select("id")
    .single();
  if (error) return "Erro ao agendar: " + error.message;

  await admin
    .from("app_leads")
    .update({ coluna: "agendado", temperatura: "quente", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);

  // Ledger: agendamento criado pela IA (fato para conversão/atribuição).
  await registrarEvento({
    tenantId,
    leadId,
    tipo: "appointment_booked",
    canal: lead?.canal ?? null,
    dados: { por_ia: true, servico, inicio: inicio.toISOString(), agendamento_id: novo?.id ?? null },
  });

  // 2ª camada: cria o evento no Google Calendar do cliente e guarda o id. Best-effort.
  const eventId = await criarEventoGoogle(tenantId, {
    summary: `${servico} — ${nome}`,
    descricao: `Agendado pela IA (Lolze).${lead?.telefone ? ` Tel: ${lead.telefone}` : ""}`,
    inicioISO: inicio.toISOString(),
    fimISO: fim.toISOString(),
  });
  if (eventId && novo?.id) {
    await admin.from("app_agendamentos").update({ google_event_id: eventId }).eq("id", novo.id);
  }

  const fmt = inicio.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Agendamento criado para ${fmt} (${dur} min) e já visível na Agenda do painel. Confirme o horário com o lead numa frase curta.`;
}
