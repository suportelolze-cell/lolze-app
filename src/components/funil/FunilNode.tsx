"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export type FunilNodeData = {
  variante: "origem" | "captura" | "ia" | "rota" | "cofre";
  tom?: "descarte" | "auto" | "handoff";
  icone: string;
  titulo: string;
  metrica: string;
  metricaLabel: string;
  micro?: string;
};

const handleStyle = { opacity: 0, width: 1, height: 1, border: "none" };

export function FunilNode({ data }: NodeProps) {
  const d = data as FunilNodeData;

  if (d.variante === "cofre") {
    return (
      <div className="w-56 rounded-xl border-2 border-marca bg-marca p-5 text-bege-principal shadow-xl">
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <div className="mb-1 text-2xl">{d.icone}</div>
        <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {d.titulo}
        </div>
        <div className="mt-1 text-3xl font-bold leading-none">{d.metrica}</div>
        <div className="mt-0.5 text-xs opacity-80">{d.metricaLabel}</div>
        {d.micro && <div className="mt-2 text-sm font-semibold">{d.micro}</div>}
      </div>
    );
  }

  const tomBorda =
    d.tom === "descarte"
      ? "border-l-red-400"
      : d.tom === "auto"
      ? "border-l-marca"
      : d.tom === "handoff"
      ? "border-l-amber-400"
      : d.variante === "ia"
      ? "border-l-escuro-quente"
      : "border-l-cinza-600";

  return (
    <div
      className={`w-48 rounded-lg border border-borda border-l-[3px] bg-superficie p-3 shadow-sm ${tomBorda}`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-lg">{d.icone}</span>
        <span className="text-xs font-bold leading-tight text-texto">
          {d.titulo}
        </span>
      </div>
      <div className="text-2xl font-bold leading-none text-texto">{d.metrica}</div>
      <div className="mt-0.5 text-[11px] text-texto-suave">{d.metricaLabel}</div>
      {d.micro && (
        <div className="mt-1.5 text-[11px] leading-snug text-texto-suave">
          {d.micro}
        </div>
      )}
    </div>
  );
}
