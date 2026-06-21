// Dados do Raio-X do Funil (Tela 6). Mock — virá de n8n agregando Meta/Google/GA4 + CRM.

export type Periodo = "hoje" | "7" | "15" | "30";

export type DadosFunil = {
  metaCliques: number;
  metaInvest: number;
  googleCliques: number;
  googleInvest: number;
  visitantes: number;
  lpConv: number; // % conversão da landing
  conversas: number;
  descartados: number;
  agendAuto: number;
  handoff: number;
  vendas: number;
  faturamento: number;
  conversaoGlobal: number; // % clique → venda
};

export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7", rotulo: "Últimos 7 dias" },
  { id: "15", rotulo: "Últimos 15 dias" },
  { id: "30", rotulo: "Últimos 30 dias" },
];

export const DADOS: Record<Periodo, DadosFunil> = {
  hoje: {
    metaCliques: 120, metaInvest: 180, googleCliques: 64, googleInvest: 120,
    visitantes: 150, lpConv: 38, conversas: 57,
    descartados: 22, agendAuto: 12, handoff: 23,
    vendas: 8, faturamento: 9600, conversaoGlobal: 4.3,
  },
  "7": {
    metaCliques: 820, metaInvest: 1240, googleCliques: 410, googleInvest: 760,
    visitantes: 980, lpConv: 41, conversas: 402,
    descartados: 150, agendAuto: 96, handoff: 156,
    vendas: 53, faturamento: 68900, conversaoGlobal: 4.3,
  },
  "15": {
    metaCliques: 1760, metaInvest: 2680, googleCliques: 890, googleInvest: 1620,
    visitantes: 2100, lpConv: 40, conversas: 860,
    descartados: 320, agendAuto: 205, handoff: 335,
    vendas: 112, faturamento: 145600, conversaoGlobal: 4.2,
  },
  "30": {
    metaCliques: 3520, metaInvest: 4820, googleCliques: 1780, googleInvest: 3100,
    visitantes: 4180, lpConv: 39, conversas: 1710,
    descartados: 640, agendAuto: 410, handoff: 660,
    vendas: 224, faturamento: 291200, conversaoGlobal: 4.2,
  },
};

export const real = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const num = (n: number) => n.toLocaleString("pt-BR");
