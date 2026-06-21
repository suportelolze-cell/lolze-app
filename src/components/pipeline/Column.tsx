"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ColunaConfig, Lead } from "@/lib/leads";
import { LeadCard } from "./LeadCard";

export function Column({
  config,
  leads,
  onPerfil,
}: {
  config: ColunaConfig;
  leads: Lead[];
  onPerfil: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Cabeçalho da coluna */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-texto">
            <span>{config.emoji}</span>
            {config.titulo}
          </h3>
          <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-semibold text-texto-suave">
            {leads.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-texto-suave">
          {config.microcopy}
        </p>
      </div>

      {/* Área de drop */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-marca bg-marca-suave/40" : "border-borda bg-fundo"
        }`}
      >
        {leads.length === 0 ? (
          <p className="px-2 py-8 text-center text-[11px] italic text-texto-suave">
            {config.vazio}
          </p>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onPerfil={onPerfil} />
          ))
        )}
      </div>
    </div>
  );
}
