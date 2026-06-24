"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Plus, Ban } from "lucide-react";
import { type Agendamento } from "@/lib/agenda";
import { WeekGrid } from "./WeekGrid";
import { MonthGrid } from "./MonthGrid";
import { AntiFaltasPanel } from "./AntiFaltasPanel";
import { CompromissoDetail } from "./CompromissoDetail";
import { AgendaFormModal, type ModoModal } from "./AgendaFormModal";

type View = "dia" | "semana" | "mes";

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        ativo
          ? "border-marca bg-marca-suave text-marca"
          : "border-borda bg-superficie text-texto-suave hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}

export function Agenda({
  agendamentos,
  googleConectado = false,
}: {
  agendamentos: Agendamento[];
  googleConectado?: boolean;
}) {
  const router = useRouter();
  // Auto-refresh: rebusca os dados (inclui eventos do Google) a cada 60s.
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

  const filtrados = useMemo(
    () =>
      agendamentos.filter((a) => {
        const porStatus =
          (a.status === "confirmado" && confirmados) ||
          (a.status === "pendente" && pendentes);
        const porIA = !soIA || a.porIA;
        return porStatus && porIA;
      }),
    [agendamentos, confirmados, pendentes, soIA]
  );

  const preenchidosIA = agendamentos.filter((a) => a.porIA).length;
  const diasVisiveis = view === "dia" ? [0] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Agenda Mágica
          </h1>
          <p className="mt-1 text-texto-suave">
            Sua agenda lotada e blindada contra faltas. Deixe a IA cuidar dos
            lembretes.
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

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md bg-superficie p-1">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                view === v
                  ? "bg-marca text-bege-principal"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              {v === "mes" ? "Mês" : v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={confirmados} onClick={() => setConfirmados((v) => !v)}>
            ✅ Confirmados
          </Chip>
          <Chip ativo={pendentes} onClick={() => setPendentes((v) => !v)}>
            ⏳ Aguardando Confirmação
          </Chip>
          <Chip ativo={soIA} onClick={() => setSoIA((v) => !v)}>
            🤖 Agendados pela IA
          </Chip>
        </div>
      </div>

      {/* Grade + painel */}
      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          {view === "mes" ? (
            <MonthGrid agendamentos={filtrados} onSelect={setSelecionado} />
          ) : (
            <WeekGrid
              diasVisiveis={diasVisiveis}
              agendamentos={filtrados}
              onSelect={setSelecionado}
            />
          )}
        </div>
        <AntiFaltasPanel preenchidosIA={preenchidosIA} />
      </div>

      <CompromissoDetail
        agendamento={selecionado}
        onClose={() => setSelecionado(null)}
      />

      <AgendaFormModal modo={modal} onClose={() => setModal(null)} />
    </div>
  );
}
