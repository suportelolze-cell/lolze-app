"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { criarAgendamentoManual, bloquearHorario } from "@/lib/supabase/agenda-actions";

export type ModoModal = "agendar" | "bloquear" | null;

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm text-texto outline-none focus:border-marca";

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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!modo) return null;
  const bloquear = modo === "bloquear";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const r = bloquear
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={salvar}
        className="w-full max-w-md space-y-4 rounded-xl border border-borda bg-superficie p-6 shadow-xl"
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

        <div className="grid grid-cols-3 gap-3">
          <Campo label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className={inputCls} />
          </Campo>
          <Campo label="Hora">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required className={inputCls} />
          </Campo>
          <Campo label="Duração (min)">
            <input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className={inputCls} />
          </Campo>
        </div>

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-sm border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={`flex items-center gap-2 rounded-sm px-5 py-2 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50 ${
              bloquear ? "bg-escuro-quente" : "bg-marca"
            }`}
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
            {bloquear ? "Bloquear" : "Agendar"}
          </button>
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
