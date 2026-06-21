"use client";

import { useState } from "react";
import type { TracaoPonto } from "@/lib/supabase/crm-data";

type Periodo = 7 | 14 | 30;

const W = 720;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 24, left: 12 };

function pontos(serie: number[], max: number) {
  const n = serie.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return serie.map((v, i) => {
    const x = PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = PAD.top + innerH - (max === 0 ? 0 : (v / max) * innerH);
    return [x, y] as const;
  });
}

const linha = (pts: ReadonlyArray<readonly [number, number]>) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function TracaoChart({ dados }: { dados: TracaoPonto[] }) {
  const [periodo, setPeriodo] = useState<Periodo>(14);

  const janela = dados.slice(-periodo);
  const leads = janela.map((d) => d.leads);
  const agend = janela.map((d) => d.agendamentos);
  const max = Math.max(1, ...leads) * 1.15;
  const vazio = leads.every((v) => v === 0);

  const ptsLeads = pontos(leads, max);
  const ptsAgend = pontos(agend, max);
  const area = `${linha(ptsLeads)} L${(W - PAD.right).toFixed(1)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`;

  return (
    <div className="rounded-lg border border-borda bg-superficie p-6">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h3 className="font-corpo text-lg font-bold text-texto">Velocidade de Tração</h3>
          <p className="text-[13px] text-texto-suave">Volume de Leads vs. Agendamentos</p>
        </div>
        <div className="flex gap-1 rounded-md bg-fundo p-1">
          {([7, 14, 30] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                periodo === p ? "bg-superficie text-texto shadow-sm" : "text-texto-suave hover:text-texto"
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 mt-3 flex gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-texto-suave">
          <span className="h-2.5 w-2.5 rounded-full bg-marca" /> Leads
        </span>
        <span className="flex items-center gap-1.5 text-texto-suave">
          <span className="h-2.5 w-2.5 rounded-full bg-cinza-600" /> Agendamentos
        </span>
      </div>

      {vazio ? (
        <div className="flex h-[240px] items-center justify-center px-8 text-center">
          <p className="max-w-sm text-sm italic text-texto-suave">
            Aguardando os primeiros cliques. Assim que o tráfego rodar, sua curva
            de crescimento aparecerá aqui.
          </p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="grad-leads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803D" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#15803D" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => {
            const y = PAD.top + (H - PAD.top - PAD.bottom) * f;
            return <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#E2DED2" strokeWidth={1} />;
          })}
          <path d={area} fill="url(#grad-leads)" />
          <path d={linha(ptsLeads)} fill="none" stroke="#15803D" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={linha(ptsAgend)} fill="none" stroke="#5A554C" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
