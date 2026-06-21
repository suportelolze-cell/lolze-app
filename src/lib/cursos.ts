// Modelo de dados da Universidade Lolze (Tela 5). Mock.

export type Trilha = "fast" | "equipe";

export type Video = {
  id: string;
  titulo: string;
  duracao: number; // minutos
  descricao: string;
  trilha: Trilha;
  icone: string;
};

export const VIDEOS: Video[] = [
  // Fast-Track (obrigatório, para o dono)
  {
    id: "v1",
    titulo: "O Tour pelo Centro de Comando",
    duracao: 3,
    descricao: "Como ler suas métricas de lucro e entender de onde vêm seus clientes.",
    trilha: "fast",
    icone: "📊",
  },
  {
    id: "v2",
    titulo: "A Mente da Inteligência Artificial",
    duracao: 4,
    descricao: "Descubra como nossa IA atende, filtra e aquece seus leads automaticamente.",
    trilha: "fast",
    icone: "🤖",
  },
  {
    id: "v3",
    titulo: "O Xeque-Mate (O Handoff)",
    duracao: 5,
    descricao: "O momento exato de pausar o robô, assumir o atendimento humano e fechar a venda.",
    trilha: "fast",
    icone: "🎯",
  },
  // Linha de Frente (equipe comercial)
  {
    id: "v4",
    titulo: "Dominando o Pipeline (Kanban)",
    duracao: 4,
    descricao: "Como organizar os cards para nunca esquecer de um cliente.",
    trilha: "equipe",
    icone: "🗂️",
  },
  {
    id: "v5",
    titulo: "Scripts de Fechamento Pós-IA",
    duracao: 6,
    descricao: "O que dizer quando você assume a conversa iniciada pelo robô.",
    trilha: "equipe",
    icone: "💬",
  },
  {
    id: "v6",
    titulo: "Blindando a Agenda",
    duracao: 3,
    descricao: "Como ativar os lembretes automáticos e zerar as faltas.",
    trilha: "equipe",
    icone: "🛡️",
  },
];

export const FAQS: string[] = [
  "Como adicionar um novo usuário na plataforma",
  "Onde vejo o custo por agendamento?",
  "Como alterar o horário de um cliente",
  "Como integro meu Google Calendar?",
  "Como conecto o WhatsApp Oficial?",
  "Onde encontro minhas notas fiscais?",
];
