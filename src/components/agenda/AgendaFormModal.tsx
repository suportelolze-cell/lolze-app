"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import {
  criarAgendamentoManual,
  bloquearHorario,
  bloquearHorarioEmMassa,
} from "@/lib/supabase/agenda-actions";
import { Button } from "@/components/ui";

export type ModoModal = "agendar" | "bloquear" | null;

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm text-texto outline-none transition-colors focus:border-marca";

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function hoje() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (fuso local)
}

export function AgendaFormModal({ modo, onClose }: { modo: ModoModal; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [servico, setServico] = useState("");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState(60);
  const [dias, setDias] = useState<number[]>([]); // dias da semana p/ bloqueio em massa
  const [semanas, setSemanas] = useState(4);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!modo) return null;
  const bloquear = modo === "bloquear";
  const emMassa = bloquear && dias.length > 0;

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const r = emMassa
        ? await bloquearHorarioEmMassa({ diasSemana: dias, hora, duracaoMin: duracao, motivo, semanas })
        : bloquear
          ? await bloquearHorario({ data, hora, duracaoMin: duracao, motivo })
          : await criarAgendamentoManual({ nome, telefone, servico, data, hora, duracaoMin: duracao });
      if (r.ok) {
        router.refresh();
        onClose();
      } else {
        setErro(r.erro ?? "Não foi possível salvar.");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={salvar}
        className="my-auto max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-borda bg-superficie p-6 shadow-pop"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-corpo text-lg font-bold text-texto">
            {bloquear ? "Bloquear horário" : "Novo agendamento"}
          </h2>
          <button type="button" onClick={onClose} className="text-texto-suave hover:text-texto">
            <X size={18} />
          </button>
        </div>

        {!bloquear && (
          <>
            <Campo label="Nome do cliente">
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputCls} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Telefone / WhatsApp">
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} />
              </Campo>
              <Campo label="Serviço">
                <input value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Reunião" className={inputCls} />
              </Campo>
            </div>
          </>
        )}

        {bloquear && (
          <Campo label="Motivo (opcional)">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Almoço, folga…" className={inputCls} />
          </Campo>
        )}

        {/* Bloqueio em massa: dias da semana */}
        {bloquear && (
          <div>
            <span className="mb-1 block text-xs font-semibold text-texto">
              Repetir nos dias <span className="font-normal text-texto-suave">(deixe sem marcar p/ bloquear só a data)</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_LABEL.map((d, i) => {
                const on = dias.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDia(i)}
                    className={`rounded-pill border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      on ? "border-marca bg-marca text-bege-principal" : "border-borda text-texto-suave hover:border-marca"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {!emMassa && (
            <Campo label="Data">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required={!emMassa} className={inputCls} />
            </Campo>
          )}
          {emMassa && (
            <Campo label="Por (semanas)">
              <input type="number" min={1} max={52} value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} className={inputCls} />
            </Campo>
          )}
          <Campo label="Hora">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required className={inputCls} />
          </Campo>
          <Campo label="Duração (min)">
            <input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className={inputCls} />
          </Campo>
        </div>

        {emMassa && (
          <p className="text-xs text-texto-suave">
            Vai bloquear <b>{hora}</b> ({duracao} min) em <b>{dias.length} dia(s)/semana</b> pelas próximas{" "}
            <b>{semanas} semana(s)</b>.
          </p>
        )}

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant={bloquear ? "primary" : "verde"} size="sm" disabled={salvando}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
            {bloquear ? (emMassa ? "Bloquear em massa" : "Bloquear") : "Agendar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-texto">{label}</span>
      {children}
    </label>
  );
}
