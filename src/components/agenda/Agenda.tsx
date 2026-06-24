"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Plus, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { type Agendamento } from "@/lib/agenda";
import { WeekGrid } from "./WeekGrid";
import { MonthGrid } from "./MonthGrid";
import { AntiFaltasPanel } from "./AntiFaltasPanel";
import { CompromissoDetail } from "./CompromissoDetail";
import { AgendaFormModal, type ModoModal } from "./AgendaFormModal";

type View = "dia" | "semana" | "mes";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        ativo ? "border-marca bg-marca-suave text-marca" : "border-borda bg-superficie text-texto-suave hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}

export function Agenda({
  agendamentos,
  googleConectado = false,
  refISO,
}: {
  agendamentos: Agendamento[];
  googleConectado?: boolean;
  refISO: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const [view, setView] = useState<View>("semana");
  const [confirmados, setConfirmados] = useState(true);
  const [pendentes, setPendentes] = useState(true);
  const [soIA, setSoIA] = useState(false);
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null);
  const [modal, setModal] = useState<ModoModal>(null);

  const ref = parseISO(refISO);
  const dowRef = (ref.getDay() + 6) % 7; // 0 = Seg
  const segunda = addDays(ref, -dowRef);
  const diasISO = Array.from({ length: 7 }, (_, i) => toISO(addDays(segunda, i)));
  const ano = ref.getFullYear();
  const mes = ref.getMonth();

  function navegar(delta: number) {
    const d = parseISO(refISO);
    if (view === "mes") d.setMonth(d.getMonth() + delta);
    else if (view === "dia") d.setDate(d.getDate() + delta);
    else d.setDate(d.getDate() + delta * 7);
    router.push(`/agenda?ref=${toISO(d)}`);
  }

  const filtrados = useMemo(
    () =>
      agendamentos.filter((a) => {
        const porStatus =
          (a.status === "confirmado" && confirmados) || (a.status === "pendente" && pendentes);
        const porIA = !soIA || a.porIA;
        return porStatus && porIA;
      }),
    [agendamentos, confirmados, pendentes, soIA]
  );

  const prefMes = `${ano}-${String(mes + 1).padStart(2, "0")}-`;
  const doMes = agendamentos.filter((a) => !a.externo && a.dataISO?.startsWith(prefMes));
  const agendamentosMes = doMes.filter((a) => !a.bloqueio).length;
  const preenchidosIA = doMes.filter((a) => a.porIA).length;
  const diasVisiveis = view === "dia" ? [dowRef] : [0, 1, 2, 3, 4, 5, 6];
  const label =
    view === "mes"
      ? `${MESES[mes]} ${ano}`
      : view === "dia"
        ? refISO.split("-").reverse().join("/")
        : `Semana de ${diasISO[0].slice(8)}/${diasISO[0].slice(5, 7)}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">Agenda Mágica</h1>
          <p className="mt-1 text-texto-suave">
            Sua agenda lotada e blindada contra faltas. Deixe a IA cuidar dos lembretes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {googleConectado ? (
            <span className="flex items-center gap-1.5 rounded-full bg-marca-suave px-3 py-1.5 text-xs font-semibold text-marca">
              <RefreshCw size={13} /> Sincronizado com Google Calendar
            </span>
          ) : (
            <a
              href="/configuracoes"
              className="flex items-center gap-1.5 rounded-full border border-borda px-3 py-1.5 text-xs font-semibold text-texto-suave hover:text-texto"
            >
              <RefreshCw size={13} /> Conectar Google Calendar
            </a>
          )}
          <button
            onClick={() => setModal("bloquear")}
            className="flex items-center gap-1.5 rounded-sm border border-borda px-3 py-2 text-sm font-semibold text-texto hover:bg-superficie"
          >
            <Ban size={15} /> Bloquear Horário
          </button>
          <button
            onClick={() => setModal("agendar")}
            className="flex items-center gap-1.5 rounded-sm bg-marca px-4 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
          >
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-md bg-superficie p-1">
            {(["dia", "semana", "mes"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  view === v ? "bg-marca text-bege-principal" : "text-texto-suave hover:text-texto"
                }`}
              >
                {v === "mes" ? "Mês" : v}
              </button>
            ))}
          </div>
          {/* Navegação de período */}
          <div className="flex items-center gap-1">
            <button onClick={() => navegar(-1)} className="rounded-md border border-borda p-1.5 text-texto-suave hover:bg-superficie hover:text-texto">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-texto">{label}</span>
            <button onClick={() => navegar(1)} className="rounded-md border border-borda p-1.5 text-texto-suave hover:bg-superficie hover:text-texto">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => router.push("/agenda")} className="ml-1 rounded-md border border-borda px-2.5 py-1.5 text-xs font-semibold text-texto-suave hover:bg-superficie hover:text-texto">
              Hoje
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={confirmados} onClick={() => setConfirmados((v) => !v)}>✅ Confirmados</Chip>
          <Chip ativo={pendentes} onClick={() => setPendentes((v) => !v)}>⏳ Aguardando Confirmação</Chip>
          <Chip ativo={soIA} onClick={() => setSoIA((v) => !v)}>🤖 Agendados pela IA</Chip>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          {view === "mes" ? (
            <MonthGrid agendamentos={filtrados} ano={ano} mes={mes} onSelect={setSelecionado} />
          ) : (
            <WeekGrid diasVisiveis={diasVisiveis} diasISO={diasISO} agendamentos={filtrados} onSelect={setSelecionado} />
          )}
        </div>
        <AntiFaltasPanel preenchidosIA={preenchidosIA} agendamentosMes={agendamentosMes} />
      </div>

      <CompromissoDetail agendamento={selecionado} onClose={() => setSelecionado(null)} />
      <AgendaFormModal modo={modal} onClose={() => setModal(null)} />
    </div>
  );
}
