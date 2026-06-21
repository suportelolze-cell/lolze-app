"use client";

import { useState } from "react";
import { ShieldCheck, TrendingUp, Bot } from "lucide-react";

function Toggle({
  ativo,
  onToggle,
}: {
  ativo: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        ativo ? "bg-marca" : "bg-cinza-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          ativo ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const inicial = [
  {
    titulo: "Ativar Confirmação 24h Antes",
    micro: 'A IA enviará: "Olá, confirme sua presença para amanhã digitando 1."',
    ativo: true,
  },
  {
    titulo: "Ativar Lembrete 2h Antes",
    micro: "A IA enviará um lembrete final para garantir o comparecimento.",
    ativo: true,
  },
  {
    titulo: "Resgate Automático de Desmarcação",
    micro: "Se o cliente desmarcar, a IA tentará reagendar imediatamente.",
    ativo: false,
  },
];

export function AntiFaltasPanel({ preenchidosIA }: { preenchidosIA: number }) {
  const [toggles, setToggles] = useState(inicial);

  return (
    <div className="flex w-80 shrink-0 flex-col rounded-lg border border-borda bg-superficie">
      <div className="border-b border-borda px-5 py-4">
        <h2 className="flex items-center gap-2 font-corpo text-base font-bold text-texto">
          <ShieldCheck size={18} className="text-marca" /> Blindagem Anti-Faltas
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-texto-suave">
          Configure a IA para cobrar a presença dos seus clientes automaticamente
          no WhatsApp. Chega de horários vazios.
        </p>
      </div>

      {/* Toggles */}
      <div className="flex-1 space-y-4 px-5 py-4">
        {toggles.map((t, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-texto">{t.titulo}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-texto-suave">
                {t.micro}
              </p>
            </div>
            <Toggle
              ativo={t.ativo}
              onToggle={() =>
                setToggles((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, ativo: !x.ativo } : x))
                )
              }
            />
          </div>
        ))}
      </div>

      {/* Métricas */}
      <div className="space-y-3 border-t border-borda px-5 py-4">
        <div className="flex items-center justify-between rounded-md bg-marca-suave/50 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-texto">
            <TrendingUp size={14} className="text-marca" /> Comparecimento (mês)
          </span>
          <span className="text-sm font-bold text-marca">85% 📈</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-fundo px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-texto">
            <Bot size={14} className="text-texto-suave" /> Preenchidos pela IA
          </span>
          <span className="text-sm font-bold text-texto">
            {preenchidosIA} esta semana
          </span>
        </div>
      </div>
    </div>
  );
}
