"use client";

import type { Agendamento } from "@/lib/agenda";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthGrid({
  agendamentos,
  ano,
  mes,
  onSelect,
}: {
  agendamentos: Agendamento[];
  ano: number;
  mes: number; // 0-indexed
  onSelect: (a: Agendamento) => void;
}) {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0=Dom
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}-`;

  // Agrupa por dia do mês usando a data real (dataISO).
  const porDia = new Map<number, Agendamento[]>();
  for (const a of agendamentos) {
    if (!a.dataISO || !a.dataISO.startsWith(prefixo)) continue;
    const dd = parseInt(a.dataISO.slice(8), 10);
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
        {MESES[mes]} {ano}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {SEMANA.map((d) => (
          <div key={d} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
            {d}
          </div>
        ))}
        {celulas.map((dia, i) => {
          const items = dia ? porDia.get(dia) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-md border p-1.5 ${dia ? "border-borda bg-fundo" : "border-transparent"}`}
            >
              {dia && (
                <>
                  <div className="mb-1 text-right text-xs font-semibold text-texto-suave">{dia}</div>
                  <div className="space-y-1">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onSelect(a)}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold ${
                          a.externo
                            ? "bg-borda/50 text-texto-suave"
                            : a.status === "confirmado"
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
