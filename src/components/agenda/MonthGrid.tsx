"use client";

import type { Agendamento } from "@/lib/agenda";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Mês de referência do mock: Junho/2026
const ANO = 2026;
const MES = 5; // 0-indexed → junho

export function MonthGrid({
  agendamentos,
  onSelect,
}: {
  agendamentos: Agendamento[];
  onSelect: (a: Agendamento) => void;
}) {
  const primeiroDiaSemana = new Date(ANO, MES, 1).getDay(); // 0=Dom
  const diasNoMes = new Date(ANO, MES + 1, 0).getDate();

  // Agrupa agendamentos por dia do mês (parse "DD/06")
  const porDia = new Map<number, Agendamento[]>();
  for (const a of agendamentos) {
    const dd = parseInt(a.dataLabel.split("/")[0], 10);
    porDia.set(dd, [...(porDia.get(dd) ?? []), a]);
  }

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <div className="rounded-lg border border-borda bg-superficie p-4">
      <div className="mb-2 text-center text-sm font-bold text-texto">
        Junho 2026
      </div>
      <div className="grid grid-cols-7 gap-px">
        {SEMANA.map((d) => (
          <div
            key={d}
            className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-texto-suave"
          >
            {d}
          </div>
        ))}
        {celulas.map((dia, i) => {
          const items = dia ? porDia.get(dia) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-md border p-1.5 ${
                dia ? "border-borda bg-fundo" : "border-transparent"
              }`}
            >
              {dia && (
                <>
                  <div className="mb-1 text-right text-xs font-semibold text-texto-suave">
                    {dia}
                  </div>
                  <div className="space-y-1">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onSelect(a)}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold ${
                          a.status === "confirmado"
                            ? "bg-marca-suave text-marca"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {a.inicio}h {a.nome}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
