"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ColunaConfig, Lead } from "@/lib/leads";
import { LeadCard } from "./LeadCard";
import { Badge } from "@/components/ui";

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
    <div className="flex w-72 shrink-0 snap-start flex-col">
      {/* Cabeçalho da coluna */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-texto">
            <span>{config.emoji}</span>
            {config.titulo}
          </h3>
          <Badge tom="neutro">{leads.length}</Badge>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-texto-suave">
          {config.microcopy}
        </p>
      </div>

      {/* Área de drop */}
      <div
        ref={setNodeRef}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-marca bg-marca-suave/40" : "border-borda bg-fundo-2"
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
