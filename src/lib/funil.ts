// Tipos e helpers do Raio-X do Funil. Os dados reais vêm do CRM (getFunilDados).

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

export const real = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const num = (n: number) => n.toLocaleString("pt-BR");
