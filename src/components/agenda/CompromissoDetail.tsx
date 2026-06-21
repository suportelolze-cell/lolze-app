"use client";

import { X, Clock, Phone, Sparkles, MessageSquare, CalendarClock, Trash2 } from "lucide-react";
import { DIAS, type Agendamento } from "@/lib/agenda";

export function CompromissoDetail({
  agendamento,
  onClose,
}: {
  agendamento: Agendamento | null;
  onClose: () => void;
}) {
  if (!agendamento) return null;
  const a = agendamento;
  const fim = a.inicio + a.duracao;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-escuro-quente/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-superficie shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-borda px-6 py-4">
          <h2 className="font-corpo text-lg font-bold text-texto">
            Detalhes do Compromisso
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-texto-suave hover:bg-fundo"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-texto">{a.nome}</h3>
            <span className="text-xs text-texto-suave">
              {a.servico} · via {a.origem}
            </span>
          </div>

          <div className="space-y-2 text-sm text-texto">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-texto-suave" />
              {DIAS[a.dia]}, {a.dataLabel} · {a.inicio}:00 às {fim}:00
            </div>
            <div className="flex items-center gap-2">
              <Phone size={15} className="text-texto-suave" />
              {a.telefone}
            </div>
            <div>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  a.status === "confirmado"
                    ? "bg-marca-suave text-marca"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {a.status === "confirmado"
                  ? "🟢 Confirmado via WhatsApp"
                  : "🟡 Confirmação Pendente"}
              </span>
            </div>
          </div>

          {/* Notas da IA */}
          <div className="rounded-lg bg-marca-suave/50 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-marca">
              <Sparkles size={13} /> Notas do Atendimento Prévio
            </p>
            <p className="text-sm leading-relaxed text-texto">{a.notas}</p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2 border-t border-borda px-6 py-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-2.5 text-sm font-semibold text-bege-principal">
            <MessageSquare size={16} /> Abrir Chat no WhatsApp
          </button>
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-borda py-2 text-xs font-semibold text-texto hover:bg-fundo">
              <CalendarClock size={14} /> Reagendar
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-borda py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
