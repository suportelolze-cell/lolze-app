// Modelo de dados da Agenda Mágica. Os dados reais vêm do Supabase (app_agendamentos)
// + Google Calendar; ver getAgendamentosApp / getOcupadosGoogle.

import type { Origem } from "@/lib/leads";

export type StatusAgendamento = "confirmado" | "pendente";

export type Agendamento = {
  id: string;
  nome: string;
  servico: string;
  origem: Origem;
  dia: number; // 0 = Seg ... 5 = Sáb
  inicio: number; // hora (8–19)
  duracao: number; // em horas
  status: StatusAgendamento;
  porIA: boolean;
  telefone: string;
  dataLabel: string; // ex: "13/06"
  notas: string;
  externo?: boolean; // true = bloco importado do Google Calendar (não editável)
  bloqueio?: boolean; // true = horário bloqueado manualmente (indisponível)
  dataISO?: string; // "YYYY-MM-DD" em BRT — usado para filtrar semana/mês reais
};

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
