// Modelo de dados da Agenda Mágica (Tela 4). Mock — virá do Google Calendar API + Supabase.

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

export const AGENDAMENTOS: Agendamento[] = [
  {
    id: "a1",
    nome: "Carlos Silva",
    servico: "Consulta Inicial",
    origem: "Meta Ads",
    dia: 0,
    inicio: 9,
    duracao: 1,
    status: "confirmado",
    porIA: true,
    telefone: "+55 11 92222-7070",
    dataLabel: "16/06",
    notas:
      "Cliente demonstrou alto interesse. Relatou urgência. Lembre-se de mencionar a condição especial de pagamento.",
  },
  {
    id: "a2",
    nome: "Fernanda Alves",
    servico: "Avaliação",
    origem: "Instagram",
    dia: 0,
    inicio: 14,
    duracao: 1,
    status: "pendente",
    porIA: true,
    telefone: "+55 11 91111-8080",
    dataLabel: "16/06",
    notas: "Agendou consulta inicial. Confirmar presença na véspera.",
  },
  {
    id: "a3",
    nome: "Mariana Souza",
    servico: "Clareamento",
    origem: "Meta Ads",
    dia: 1,
    inicio: 10,
    duracao: 2,
    status: "confirmado",
    porIA: true,
    telefone: "+55 11 94444-5050",
    dataLabel: "17/06",
    notas: "Urgência alta, orçamento liberado. Tem evento no próximo mês.",
  },
  {
    id: "a4",
    nome: "Roberto Dias",
    servico: "Implante (avaliação)",
    origem: "Site",
    dia: 2,
    inicio: 11,
    duracao: 1,
    status: "confirmado",
    porIA: false,
    telefone: "+55 11 93333-6060",
    dataLabel: "18/06",
    notas: "Pediu parcelamento. Apresentar condição em até 12x.",
  },
  {
    id: "a5",
    nome: "Patrícia Gomes",
    servico: "Consulta Inicial",
    origem: "Site",
    dia: 2,
    inicio: 16,
    duracao: 1,
    status: "pendente",
    porIA: true,
    telefone: "+55 11 97777-2020",
    dataLabel: "18/06",
    notas: "Preencheu o formulário do site. Confirmar interesse.",
  },
  {
    id: "a6",
    nome: "João Pedro Lima",
    servico: "Retorno",
    origem: "Instagram",
    dia: 3,
    inicio: 9,
    duracao: 1,
    status: "confirmado",
    porIA: true,
    telefone: "+55 11 96666-3030",
    dataLabel: "19/06",
    notas: "Retorno de acompanhamento. Cliente recorrente.",
  },
  {
    id: "a7",
    nome: "Eduardo Tavares",
    servico: "Procedimento",
    origem: "Google Ads",
    dia: 4,
    inicio: 13,
    duracao: 2,
    status: "confirmado",
    porIA: false,
    telefone: "+55 11 90000-9090",
    dataLabel: "20/06",
    notas: "Pacote completo fechado. Preparar sala.",
  },
  {
    id: "a8",
    nome: "Carla Menezes",
    servico: "Avaliação",
    origem: "Google Ads",
    dia: 5,
    inicio: 10,
    duracao: 1,
    status: "pendente",
    porIA: true,
    telefone: "+55 11 95555-4040",
    dataLabel: "21/06",
    notas: "Fazendo perguntas gerais. A IA está aquecendo.",
  },
];
