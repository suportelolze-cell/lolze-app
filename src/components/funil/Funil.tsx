"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronLeft } from "lucide-react";
import { PERIODOS, real, num, type DadosFunil, type Periodo } from "@/lib/funil";
import { FunilNode } from "./FunilNode";

const nodeTypes = { funil: FunilNode };

const VERDE = "#15803D";
const VERMELHO = "#ef4444";
const AMBAR = "#d97706";
const NEUTRO = "#9c968a";

function chip(cor: string) {
  return {
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 6,
    labelStyle: { fill: cor, fontWeight: 700, fontSize: 11 },
    style: { stroke: cor, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: cor },
  };
}

export function Funil({ dados }: { dados: Record<Periodo, DadosFunil> }) {
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const d = dados[periodo];

  const pct = (n: number, base: number) =>
    base === 0 ? 0 : Math.round((n / base) * 100);

  const cliquesTotais = d.metaCliques + d.googleCliques;
  // Topo do funil (Meta/Google/Portal) vem de app_trafego. Sem integração de
  // Ads, tudo é zero — e as métricas derivadas ("Quebra 100%", "Retenção 0%",
  // "Conversão Global") viram diagnóstico falso. Quando não há tráfego, marcamos
  // como "não conectado" em vez de apresentar zero como resultado real (§4).
  const semTrafego = cliquesTotais + d.visitantes === 0;
  const quebraTrafego = 100 - pct(d.visitantes, cliquesTotais);
  const retencaoLP = pct(d.conversas, d.visitantes);
  const descartePct = pct(d.descartados, d.conversas);
  const autoPct = pct(d.agendAuto, d.conversas);
  const handoffPct = pct(d.handoff, d.conversas);
  const fechamento = pct(d.vendas, d.agendAuto + d.handoff);

  const nodes: Node[] = useMemo(
    () => [
      {
        id: "meta", type: "funil", position: { x: 0, y: 40 },
        data: { variante: "origem", icone: "📣", titulo: "Meta Ads (IG/FB)", metrica: semTrafego ? "—" : num(d.metaCliques), metricaLabel: "Cliques gerados", micro: semTrafego ? "Fonte não conectada" : `Investimento: ${real(d.metaInvest)}` },
      },
      {
        id: "google", type: "funil", position: { x: 0, y: 220 },
        data: { variante: "origem", icone: "🔍", titulo: "Google Ads", metrica: semTrafego ? "—" : num(d.googleCliques), metricaLabel: "Cliques gerados", micro: semTrafego ? "Fonte não conectada" : `Investimento: ${real(d.googleInvest)}` },
      },
      {
        id: "lp", type: "funil", position: { x: 260, y: 130 },
        data: { variante: "captura", icone: "🌐", titulo: "Portal de Captura", metrica: semTrafego ? "—" : num(d.visitantes), metricaLabel: "Visitantes únicos", micro: semTrafego ? "Fonte não conectada" : `Conversão da página: ${d.lpConv}%` },
      },
      {
        id: "ia", type: "funil", position: { x: 520, y: 130 },
        data: { variante: "ia", icone: "🤖", titulo: "Filtro de Inteligência (IA)", metrica: num(d.conversas), metricaLabel: "Conversas iniciadas", micro: "Qualificando em tempo real." },
      },
      {
        id: "descarte", type: "funil", position: { x: 820, y: -10 },
        data: { variante: "rota", tom: "descarte", icone: "🗑️", titulo: "Descartados / Frios", metrica: num(d.descartados), metricaLabel: "Leads", micro: "Seu tempo foi poupado." },
      },
      {
        id: "auto", type: "funil", position: { x: 820, y: 130 },
        data: { variante: "rota", tom: "auto", icone: "⚡", titulo: "Agendamento Automático", metrica: num(d.agendAuto), metricaLabel: "Leads", micro: "Fechados 100% pelo robô." },
      },
      {
        id: "handoff", type: "funil", position: { x: 820, y: 270 },
        data: { variante: "rota", tom: "handoff", icone: "🤝", titulo: "Intervenção Humana", metrica: num(d.handoff), metricaLabel: "Leads", micro: "Passados para o comercial." },
      },
      {
        id: "cofre", type: "funil", position: { x: 1110, y: 120 },
        data: { variante: "cofre", icone: "💰", titulo: "Caixa Gerado / Vendas", metrica: num(d.vendas), metricaLabel: "Clientes pagantes", micro: `Faturamento: ${real(d.faturamento)}` },
      },
    ],
    [d, semTrafego]
  );

  const edges: Edge[] = useMemo(
    () => [
      { id: "e-meta-lp", source: "meta", target: "lp", label: semTrafego ? undefined : `⚠️ Quebra ${quebraTrafego}%`, ...chip(semTrafego ? NEUTRO : VERMELHO) },
      { id: "e-google-lp", source: "google", target: "lp", ...chip(NEUTRO) },
      { id: "e-lp-ia", source: "lp", target: "ia", label: semTrafego ? undefined : `🔥 Retenção ${retencaoLP}%`, ...chip(semTrafego ? NEUTRO : VERDE) },
      { id: "e-ia-descarte", source: "ia", target: "descarte", label: `${descartePct}%`, ...chip(VERMELHO) },
      { id: "e-ia-auto", source: "ia", target: "auto", label: `✅ ${autoPct}%`, ...chip(VERDE) },
      { id: "e-ia-handoff", source: "ia", target: "handoff", label: `🎯 ${handoffPct}%`, ...chip(AMBAR) },
      { id: "e-auto-cofre", source: "auto", target: "cofre", ...chip(VERDE) },
      { id: "e-handoff-cofre", source: "handoff", target: "cofre", label: `Fechamento ${fechamento}%`, ...chip(AMBAR) },
    ],
    [semTrafego, quebraTrafego, retencaoLP, descartePct, autoPct, handoffPct, fechamento]
  );

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col lg:h-[calc(100vh-7rem)]">
      {/* Cabeçalho */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <a
            href="/resultados"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-suave transition-colors hover:text-marca"
          >
            <ChevronLeft size={14} /> Resultados
          </a>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Raio-X do Funil
          </h1>
          <p className="mt-1 text-texto-suave">
            O fluxo de caixa vivo, do clique ao lucro. Passe o mouse e identifique
            qualquer vazamento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="rounded-md border border-borda bg-superficie px-3 py-2 text-sm font-semibold text-texto outline-none focus:border-marca"
          >
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
          {/* Card de eficiência */}
          <div className="rounded-lg border border-marca/30 bg-superficie px-4 py-2">
            <div className="text-[11px] font-medium text-texto-suave">
              Conversão Global (Clique → Venda)
            </div>
            <div className="text-xl font-bold text-marca">
              {semTrafego ? "—" : `${d.conversaoGlobal}%`}
            </div>
          </div>
        </div>
      </header>

      {/* Aviso honesto: topo do funil depende da integração de Ads (§4). */}
      {semTrafego && (
        <div className="mb-3 rounded-lg border border-marca/30 bg-marca/5 px-4 py-2.5 text-sm text-texto-suave">
          <span className="font-semibold text-texto">Topo do funil aguardando conexão.</span>{" "}
          Meta Ads, Google Ads e Portal de Captura aparecem aqui quando você
          integrar suas campanhas. Do <em>Filtro de IA</em> em diante, os números
          já são reais, vindos das suas conversas.
        </div>
      )}

      {/* Canvas */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-borda bg-fundo">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.15}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#d8d3c7" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
