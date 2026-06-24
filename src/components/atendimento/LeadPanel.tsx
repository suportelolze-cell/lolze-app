"use client";

import { useRouter } from "next/navigation";
import { Phone, Sparkles, CalendarPlus, Trophy, Ban } from "lucide-react";
import { moverLead } from "@/lib/supabase/crm-actions";
import type { Conversa } from "@/lib/conversas";
import type { Temperatura } from "@/lib/leads";

const termometro: Record<Temperatura, { rotulo: string; classe: string; micro: string }> = {
  quente: {
    rotulo: "🔥 QUENTE",
    classe: "bg-orange-100 text-orange-700",
    micro: "Lead pronto para o fechamento. Vá direto à oferta.",
  },
  morno: {
    rotulo: "⚡ MORNO",
    classe: "bg-amber-100 text-amber-700",
    micro: "Em aquecimento. Reforce o valor antes de oferecer.",
  },
  frio: {
    rotulo: "❄️ FRIO",
    classe: "bg-sky-100 text-sky-700",
    micro: "Baixa intenção. Qualifique antes de investir tempo.",
  },
};

export function LeadPanel({ conversa }: { conversa: Conversa | null }) {
  const router = useRouter();
  if (!conversa) {
    return <div className="hidden h-full w-full border-l border-borda bg-superficie xl:block" />;
  }

  const t = termometro[conversa.temperatura];

  async function marcar(coluna: "ganho" | "perdido") {
    await moverLead(conversa!.id, coluna);
    router.refresh();
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-borda bg-superficie">
      <div className="border-b border-borda px-5 py-4">
        <h2 className="font-corpo text-base font-bold text-texto">
          Raio-X do Cliente
        </h2>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Identificação */}
        <div>
          <h3 className="text-lg font-bold text-texto">{conversa.nome}</h3>
          <span className="text-xs text-texto-suave">
            Vindo do {conversa.origem}
          </span>
          <div className="mt-2 flex items-center gap-2 text-sm text-texto">
            <Phone size={14} className="text-texto-suave" />
            {conversa.telefone}
          </div>
        </div>

        {/* Termômetro */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
            Nota de Qualificação
          </p>
          <span
            className={`inline-block rounded-md px-3 py-1 text-sm font-bold ${t.classe}`}
          >
            {t.rotulo}
          </span>
          <p className="mt-2 text-xs leading-relaxed text-texto-suave">
            {t.micro}
          </p>
        </div>

        {/* Diagnóstico da IA */}
        <div className="rounded-lg bg-marca-suave/50 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-marca">
            <Sparkles size={13} /> Resumo da Conversa (IA)
          </p>
          <p className="text-sm leading-relaxed text-texto">
            {conversa.diagnostico}
          </p>
        </div>

        {/* Notas internas */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
            Anotações (só sua equipe vê)
          </p>
          <textarea
            rows={3}
            placeholder="Escreva aqui detalhes da negociação que só a equipe deve ver..."
            className="w-full resize-none rounded-md border border-borda bg-fundo p-3 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca"
          />
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="space-y-2 border-t border-borda px-5 py-4">
        <button
          onClick={() => router.push("/agenda")}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-2.5 text-sm font-semibold text-bege-principal"
        >
          <CalendarPlus size={16} /> Agendar Reunião
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => marcar("ganho")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-borda py-2 text-xs font-semibold text-texto hover:bg-fundo"
          >
            <Trophy size={14} /> Marcar Ganho
          </button>
          <button
            onClick={() => marcar("perdido")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-borda py-2 text-xs font-semibold text-texto-suave hover:bg-fundo"
          >
            <Ban size={14} /> Descartar
          </button>
        </div>
      </div>
    </div>
  );
}
