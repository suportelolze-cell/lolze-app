/**
 * Núcleo PURO da tela "Resultados" (sem I/O, sem imports de servidor) — para
 * ter teste de regressão sobre a matemática do funil/receita/SLA. A leitura do
 * ledger (app_eventos) e o filtro de tenant ficam em resultados.ts.
 *
 * ROI VERIFICÁVEL POR EVENTOS (dossiê): cada número é um fato datado do ledger
 * imutável; se não houve evento, o número é zero. Nada é estimado.
 */

export type EventoRow = {
  tipo: string;
  lead_id: number | null;
  canal: string | null;
  origem: string | null;
  valor_cents: number | null;
  created_at: string;
};

export type EtapaResultado = {
  chave: string;
  label: string;
  descricao: string;
  total: number;
  pctDaBase: number | null; // % sobre a base (leads recebidos)
  pctDoAnterior: number | null; // conversão vindo da etapa anterior
};

export type CanalResultado = {
  canal: string;
  vendas: number;
  receita: number; // em reais
};

export type Resultados = {
  dias: number;
  temDados: boolean;
  totalEventos: number;
  etapas: EtapaResultado[];
  vendas: number;
  receitaConfirmada: number; // reais
  ticketMedio: number; // reais
  canais: CanalResultado[];
  slaMedianaMin: number | null; // mediana da 1ª resposta (min)
  pctRespondidoAte5min: number | null;
  leadsComResposta: number;
};

// Etapas do funil na ordem do ledger. A primeira é a base (referência 100%).
export const FUNIL: { tipo: string; chave: string; label: string; descricao: string }[] = [
  { tipo: "lead_received", chave: "recebidos", label: "Leads recebidos", descricao: "Chegaram por qualquer canal" },
  { tipo: "first_response_sent", chave: "respondidos", label: "Primeira resposta", descricao: "A IA respondeu o lead" },
  { tipo: "qualified", chave: "qualificados", label: "Qualificados", descricao: "Perfil e intenção confirmados" },
  { tipo: "appointment_booked", chave: "agendados", label: "Agendamentos", descricao: "Marcaram um compromisso" },
  { tipo: "appointment_attended", chave: "compareceram", label: "Compareceram", descricao: "Vieram ao compromisso" },
  { tipo: "sale_won", chave: "vendas", label: "Vendas fechadas", descricao: "Viraram cliente" },
];

const rotuloCanal: Record<string, string> = {
  whatsapp: "WhatsApp",
  whatsapp_cloud: "WhatsApp",
  instagram: "Instagram",
  site: "Site",
  demo: "Demo",
  manual: "Manual",
};

function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Conta leads distintos que atingiram a etapa; eventos sem lead_id contam 1 cada. */
function contarEtapa(evs: EventoRow[], tipo: string): number {
  const desse = evs.filter((e) => e.tipo === tipo);
  const comLead = new Set(desse.filter((e) => e.lead_id != null).map((e) => e.lead_id));
  const semLead = desse.filter((e) => e.lead_id == null).length;
  return comLead.size + semLead;
}

export function resultadoVazio(janela: number): Resultados {
  return {
    dias: janela,
    temDados: false,
    totalEventos: 0,
    etapas: FUNIL.map((f) => ({ chave: f.chave, label: f.label, descricao: f.descricao, total: 0, pctDaBase: null, pctDoAnterior: null })),
    vendas: 0,
    receitaConfirmada: 0,
    ticketMedio: 0,
    canais: [],
    slaMedianaMin: null,
    pctRespondidoAte5min: null,
    leadsComResposta: 0,
  };
}

/** Normaliza a janela para uma das faixas suportadas. */
export function normalizarJanela(dias: number): number {
  return [7, 30, 90].includes(dias) ? dias : 30;
}

/**
 * Agregação PURA — recebe as linhas do ledger e devolve os resultados
 * (funil, receita confirmada por canal, SLA da 1ª resposta).
 */
export function agregarResultados(evs: EventoRow[], dias = 30): Resultados {
  const janela = normalizarJanela(dias);
  if (evs.length === 0) return resultadoVazio(janela);

  // Funil: contagem por etapa + conversão sobre a base e sobre a etapa anterior.
  const contagens = FUNIL.map((f) => ({ f, total: contarEtapa(evs, f.tipo) }));
  const base = contagens[0].total;
  const etapas: EtapaResultado[] = contagens.map(({ f, total }, i) => {
    const anterior = i > 0 ? contagens[i - 1].total : total;
    return {
      chave: f.chave,
      label: f.label,
      descricao: f.descricao,
      total,
      pctDaBase: base > 0 ? Math.round((total / base) * 1000) / 10 : null,
      pctDoAnterior: i === 0 ? null : anterior > 0 ? Math.round((total / anterior) * 1000) / 10 : null,
    };
  });

  // Receita: valor confirmado no ledger (revenue_confirmed carrega o valor).
  const receitas = evs.filter((e) => e.tipo === "revenue_confirmed");
  const receitaCents = receitas.reduce((s, e) => s + (e.valor_cents ?? 0), 0);
  const receitaConfirmada = Math.round(receitaCents) / 100;
  const vendas = contarEtapa(evs, "sale_won");
  const ticketMedio = vendas > 0 ? Math.round(receitaConfirmada / vendas) : 0;

  // Atribuição de receita por canal (fallback origem → "Direto").
  const porCanal = new Map<string, { vendas: number; cents: number }>();
  for (const e of receitas) {
    const bruto = (e.canal || e.origem || "direto").toLowerCase();
    const nome = rotuloCanal[bruto] ?? (bruto === "direto" ? "Direto" : bruto);
    const cur = porCanal.get(nome) ?? { vendas: 0, cents: 0 };
    cur.vendas += 1;
    cur.cents += e.valor_cents ?? 0;
    porCanal.set(nome, cur);
  }
  const canais: CanalResultado[] = [...porCanal.entries()]
    .map(([canal, v]) => ({ canal, vendas: v.vendas, receita: Math.round(v.cents) / 100 }))
    .sort((a, b) => b.receita - a.receita);

  // SLA da 1ª resposta: pareia lead_received × first_response_sent por lead.
  const recebido = new Map<number, number>();
  const respondido = new Map<number, number>();
  for (const e of evs) {
    if (e.lead_id == null) continue;
    const t = new Date(e.created_at).getTime();
    if (e.tipo === "lead_received") {
      const cur = recebido.get(e.lead_id);
      if (cur == null || t < cur) recebido.set(e.lead_id, t);
    } else if (e.tipo === "first_response_sent") {
      const cur = respondido.get(e.lead_id);
      if (cur == null || t < cur) respondido.set(e.lead_id, t);
    }
  }
  const diffsMin: number[] = [];
  for (const [leadId, tr] of recebido) {
    const tresp = respondido.get(leadId);
    if (tresp != null && tresp >= tr) diffsMin.push((tresp - tr) / 60000);
  }
  const slaMedianaMin = mediana(diffsMin);
  const pctRespondidoAte5min =
    diffsMin.length > 0 ? Math.round((diffsMin.filter((d) => d <= 5).length / diffsMin.length) * 100) : null;

  return {
    dias: janela,
    temDados: true,
    totalEventos: evs.length,
    etapas,
    vendas,
    receitaConfirmada,
    ticketMedio,
    canais,
    slaMedianaMin: slaMedianaMin != null ? Math.round(slaMedianaMin * 10) / 10 : null,
    pctRespondidoAte5min,
    leadsComResposta: diffsMin.length,
  };
}
