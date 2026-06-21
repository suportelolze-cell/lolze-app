"use client";

import { DIAS, HORAS, type Agendamento } from "@/lib/agenda";

const ROW = 60; // altura de 1 hora, em px

export function WeekGrid({
  diasVisiveis,
  agendamentos,
  onSelect,
}: {
  diasVisiveis: number[];
  agendamentos: Agendamento[];
  onSelect: (a: Agendamento) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-borda bg-superficie">
      {/* Cabeçalho dos dias */}
      <div
        className="grid border-b border-borda"
        style={{ gridTemplateColumns: `56px repeat(${diasVisiveis.length}, minmax(140px, 1fr))` }}
      >
        <div className="border-r border-borda" />
        {diasVisiveis.map((d) => (
          <div
            key={d}
            className="border-r border-borda px-3 py-2 text-center"
          >
            <div className="text-sm font-bold text-texto">{DIAS[d]}</div>
          </div>
        ))}
      </div>

      {/* Corpo */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `56px repeat(${diasVisiveis.length}, minmax(140px, 1fr))` }}
      >
        {/* Coluna de horas */}
        <div className="border-r border-borda">
          {HORAS.map((h) => (
            <div
              key={h}
              className="relative border-b border-borda"
              style={{ height: ROW }}
            >
              <span className="absolute -top-2 right-1.5 text-[11px] text-texto-suave">
                {h}h
              </span>
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {diasVisiveis.map((d) => {
          const doDia = agendamentos.filter((a) => a.dia === d);
          return (
            <div
              key={d}
              className="relative border-r border-borda"
              style={{ height: ROW * HORAS.length }}
            >
              {/* Linhas-guia por hora */}
              {HORAS.map((h) => (
                <div
                  key={h}
                  className="border-b border-borda"
                  style={{ height: ROW }}
                />
              ))}

              {/* Blocos de agendamento */}
              {doDia.map((a) => {
                const top = (a.inicio - HORAS[0]) * ROW;
                const height = a.duracao * ROW - 4;
                const confirmado = a.status === "confirmado";
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    style={{ top, height }}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] p-1.5 text-left transition-shadow hover:shadow-md ${
                      confirmado
                        ? "border-l-marca bg-marca-suave"
                        : "border-l-amber-500 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold text-texto">
                      {a.porIA && <span>🤖</span>}
                      <span className="truncate">{a.nome}</span>
                    </div>
                    <div className="truncate text-[10px] text-texto-suave">
                      {a.servico}
                    </div>
                    <div
                      className={`mt-0.5 truncate text-[10px] font-semibold ${
                        confirmado ? "text-marca" : "text-amber-600"
                      }`}
                    >
                      {confirmado ? "🟢 Confirmado" : "🟡 Pendente"}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
