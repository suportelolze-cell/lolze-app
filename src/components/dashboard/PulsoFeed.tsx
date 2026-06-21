import {
  CalendarCheck,
  Flame,
  ClipboardCheck,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { PulsoEvento } from "@/lib/supabase/crm-data";

type Tipo = "agendou" | "quente" | "quiz" | "ajuda";

const estilo: Record<Tipo, { icon: LucideIcon; cor: string; bg: string }> = {
  agendou: { icon: CalendarCheck, cor: "text-marca", bg: "bg-marca-suave" },
  quente: { icon: Flame, cor: "text-orange-600", bg: "bg-orange-100" },
  quiz: { icon: ClipboardCheck, cor: "text-marca", bg: "bg-marca-suave" },
  ajuda: { icon: AlertTriangle, cor: "text-amber-700", bg: "bg-amber-100" },
};

function derivar(ev: PulsoEvento): { tipo: Tipo; texto: React.ReactNode } {
  if (ev.precisaHumano)
    return {
      tipo: "ajuda",
      texto: (
        <>
          Atenção: a IA precisa de ajuda para responder <b>{ev.nome}</b>.
        </>
      ),
    };
  if (ev.coluna === "agendado" || ev.coluna === "ganho")
    return {
      tipo: "agendou",
      texto: (
        <>
          <b>{ev.nome}</b>{" "}
          {ev.coluna === "ganho" ? "fechou negócio. 💰" : "teve reunião agendada pela IA."}
        </>
      ),
    };
  if (ev.temperatura === "quente")
    return {
      tipo: "quente",
      texto: (
        <>
          <b>{ev.nome}</b> foi qualificado como Lead Quente. Pronto para atendimento!
        </>
      ),
    };
  return {
    tipo: "quiz",
    texto: (
      <>
        <b>{ev.nome}</b> entrou no funil através do {ev.origem}.
      </>
    ),
  };
}

export function PulsoFeed({ eventos }: { eventos: PulsoEvento[] }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-borda bg-superficie p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-marca" />
        </span>
        <h3 className="font-corpo text-lg font-bold text-texto">Pulso da Operação</h3>
        <span className="text-[13px] text-texto-suave">(Ao Vivo)</span>
      </div>

      <ul className="flex-1 space-y-3">
        {eventos.length === 0 ? (
          <li className="py-8 text-center text-xs italic text-texto-suave">
            Sem atividade recente. Assim que o tráfego rodar, aparece aqui.
          </li>
        ) : (
          eventos.map((ev, i) => {
            const { tipo, texto } = derivar(ev);
            const { icon: Icon, cor, bg } = estilo[tipo];
            return (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${cor}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-texto">{texto}</p>
                  {tipo === "ajuda" && (
                    <button className="text-xs font-semibold text-marca hover:underline">
                      Assumir chat →
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <button className="mt-4 w-full rounded-md border border-borda py-2.5 text-sm font-semibold text-texto transition-colors hover:bg-fundo">
        Ver Histórico Completo
      </button>
    </div>
  );
}
