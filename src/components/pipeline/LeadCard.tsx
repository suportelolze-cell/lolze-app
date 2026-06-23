"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { MessageSquare, User } from "lucide-react";
import type { Lead, Temperatura } from "@/lib/leads";

const tempEstilo: Record<Temperatura, { rotulo: string; classe: string }> = {
  quente: { rotulo: "🔥 Quente", classe: "bg-orange-100 text-orange-700" },
  morno: { rotulo: "⚡ Morno", classe: "bg-amber-100 text-amber-700" },
  frio: { rotulo: "❄️ Frio", classe: "bg-sky-100 text-sky-700" },
};

export function LeadCard({
  lead,
  onPerfil,
  arrastando,
}: {
  lead: Lead;
  onPerfil?: (lead: Lead) => void;
  arrastando?: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const temp = tempEstilo[lead.temperatura];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-md border border-borda bg-superficie p-3 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      } ${arrastando ? "rotate-2 shadow-xl" : "shadow-sm"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-texto">
          {lead.nome}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${temp.classe}`}
        >
          {temp.rotulo}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-texto-suave">
        <span className="rounded bg-fundo px-1.5 py-0.5">
          Vindo do {lead.origem}
        </span>
        {lead.valor != null && (
          <span className="font-semibold text-marca">
            R$ {lead.valor.toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      <p className="mb-3 text-[11px] italic text-texto-suave">
        Última msg: {lead.ultimaMsg}
      </p>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/atendimento?conversa=${lead.id}`);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-marca px-2 py-1.5 text-[11px] font-semibold text-bege-principal"
        >
          <MessageSquare size={12} /> Abrir Chat
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPerfil?.(lead);
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-borda px-2 py-1.5 text-[11px] font-semibold text-texto hover:bg-fundo"
        >
          <User size={12} /> Ver Perfil
        </button>
      </div>
    </div>
  );
}
