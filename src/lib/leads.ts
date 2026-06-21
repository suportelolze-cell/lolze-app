// Tipos e configuração do Pipeline. Dados vêm do Supabase (app_leads).

export type ColunaId =
  | "entrada"
  | "qualificacao"
  | "atencao"
  | "agendado"
  | "ganho"
  | "perdido";

export type Temperatura = "quente" | "morno" | "frio";
export type Origem = "Meta Ads" | "Site" | "Instagram" | "Google Ads";

export type Lead = {
  id: number;
  nome: string;
  coluna: ColunaId;
  temperatura: Temperatura;
  origem: Origem;
  valor?: number;
  ultimaMsg: string;
  telefone: string;
  email: string;
  diagnostico: string;
};

export type ColunaConfig = {
  id: ColunaId;
  titulo: string;
  emoji: string;
  microcopy: string;
  vazio: string;
};

export const COLUNAS: ColunaConfig[] = [
  {
    id: "entrada",
    titulo: "Caixa de Entrada",
    emoji: "📥",
    microcopy: "Acabaram de chegar. A IA vai iniciar o contato em instantes.",
    vazio:
      "Sua máquina de tráfego está buscando novos clientes. Assim que clicarem, aparecerão aqui.",
  },
  {
    id: "qualificacao",
    titulo: "Em Qualificação (IA)",
    emoji: "🤖",
    microcopy: "Nossa Inteligência está filtrando e aquecendo estes contatos agora.",
    vazio: "Nenhum lead conversando com a IA neste momento.",
  },
  {
    id: "atencao",
    titulo: "Atenção Humana",
    emoji: "🎯",
    microcopy: "Leads quentes. A IA preparou o terreno. Assuma o chat e feche a venda.",
    vazio: "Tudo limpo! A IA ainda está preparando os próximos clientes para você.",
  },
  {
    id: "agendado",
    titulo: "Agendado / Reunião",
    emoji: "📅",
    microcopy: "Compromisso marcado. Lembretes automáticos já estão ativados.",
    vazio: "Nenhuma reunião marcada ainda.",
  },
  {
    id: "ganho",
    titulo: "Ganho / Fechado",
    emoji: "💰",
    microcopy: "Clientes que compareceram e pagaram. O lucro da sua operação.",
    vazio: "As vendas fechadas aparecerão aqui.",
  },
  {
    id: "perdido",
    titulo: "Perdido / Descartado",
    emoji: "❌",
    microcopy: "Leads desqualificados, sem orçamento ou que não responderam.",
    vazio: "Nada descartado por aqui.",
  },
];

// Mapeia origem do banco (snake) → rótulo de exibição
export const ORIGEM_LABEL: Record<string, Origem> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  site: "Site",
  instagram: "Instagram",
};
