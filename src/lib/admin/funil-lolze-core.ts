/**
 * Núcleo PURO do painel do funil INTERNO da Lolze (sem I/O) — para ter teste
 * de regressão sobre a matemática. A leitura de app_funil_lolze e o gate de
 * superadmin ficam em funil-lolze-data.ts.
 *
 * Honestidade (mandato): topo e jornada são medidas DIFERENTES e rotuladas
 * como tais. "Diagnóstico" conta interações e "Demo" conta MENSAGENS (não
 * visitantes únicos — o demo é por turno), então não entram no funil de
 * conversão pessoa-a-pessoa; a jornada de compra (aplicação → ativação) sim.
 */

export type LinhaFunilLolze = {
  evento: string;
  created_at: string;
  dados?: Record<string, unknown> | null;
};

export type EtapaTopo = { chave: string; label: string; descricao: string; total: number };
export type EtapaJornada = {
  chave: string;
  label: string;
  total: number;
  pctBase: number | null; // % sobre a 1ª etapa da jornada (aplicações)
  pctAnterior: number | null; // conversão vinda da etapa anterior
};

export type FunilLolzeResumo = {
  dias: number | null; // null = todo o período
  total: number;
  temDados: boolean;
  topo: EtapaTopo[];
  jornada: EtapaJornada[];
};

// Engajamento de topo (não é funil pessoa-a-pessoa).
const TOPO: { evento: string; chave: string; label: string; descricao: string }[] = [
  { evento: "diagnostico_interagido", chave: "diagnostico", label: "Diagnóstico usado", descricao: "Interações na calculadora (dedup por sessão)" },
  { evento: "demo_mensagem", chave: "demo", label: "Demo testado", descricao: "Mensagens trocadas no chat de demonstração" },
];

// Jornada de compra (funil de conversão real).
const JORNADA: { evento: string; chave: string; label: string }[] = [
  { evento: "aplicacao_enviada", chave: "aplicacao", label: "Aplicações enviadas" },
  { evento: "cadastro_criado", chave: "cadastro", label: "Cadastros criados" },
  { evento: "checkout_iniciado", chave: "checkout", label: "Checkouts iniciados" },
  { evento: "pagamento_confirmado", chave: "pagamento", label: "Pagamentos confirmados" },
  { evento: "onboarding_concluido", chave: "onboarding", label: "Ativações (onboarding)" },
];

export const EVENTOS_TOPO = TOPO.map((t) => t.evento);
export const EVENTOS_JORNADA = JORNADA.map((j) => j.evento);

/** Normaliza a janela: 7/30/90 dias ou null (tudo). */
export function normalizarJanelaFunil(dias: number | null | undefined): number | null {
  if (dias == null) return null;
  return [7, 30, 90].includes(dias) ? dias : 30;
}

function contar(rows: LinhaFunilLolze[], evento: string): number {
  let n = 0;
  for (const r of rows) if (r.evento === evento) n++;
  return n;
}

/** Agrega as linhas do funil (já filtradas pela janela) no resumo do painel. */
export function resumirFunilLolze(rows: LinhaFunilLolze[], dias: number | null = null): FunilLolzeResumo {
  const janela = normalizarJanelaFunil(dias);
  const total = rows.length;

  const topo: EtapaTopo[] = TOPO.map((t) => ({
    chave: t.chave,
    label: t.label,
    descricao: t.descricao,
    total: contar(rows, t.evento),
  }));

  const brutos = JORNADA.map((j) => ({ j, total: contar(rows, j.evento) }));
  const base = brutos[0].total;
  const jornada: EtapaJornada[] = brutos.map(({ j, total: n }, i) => {
    const anterior = i > 0 ? brutos[i - 1].total : n;
    return {
      chave: j.chave,
      label: j.label,
      total: n,
      pctBase: base > 0 ? Math.round((n / base) * 1000) / 10 : null,
      pctAnterior: i === 0 ? null : anterior > 0 ? Math.round((n / anterior) * 1000) / 10 : null,
    };
  });

  return { dias: janela, total, temDados: total > 0, topo, jornada };
}
