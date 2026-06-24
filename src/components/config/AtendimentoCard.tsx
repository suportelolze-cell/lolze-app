"use client";

import { useState } from "react";
import { Phone, Loader2, Check } from "lucide-react";
import { salvarAtendimentoCfg } from "@/lib/supabase/crm-actions";
import type { AtendimentoCfg } from "@/lib/supabase/crm-data";

const inputCls =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function AtendimentoCard({ inicial }: { inicial: AtendimentoCfg }) {
  const [especialista, setEspecialista] = useState(inicial.especialista);
  const [abre, setAbre] = useState(inicial.abre);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    setSalvando(true);
    try {
      const r = await salvarAtendimentoCfg({ especialista, abre, fecha });
      if (r.ok) setSalvo(true);
      else setErro(r.erro ?? "Não foi possível salvar.");
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-lg border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <Phone size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Especialista & Horário</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Quando a IA passar uma conversa para <strong>Atenção Humana</strong>, ela avisa este número
        no WhatsApp com um resumo. E ela só marca dentro do seu horário de atendimento.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-texto">
            Número do especialista (WhatsApp)
          </span>
          <input
            value={especialista}
            onChange={(e) => setEspecialista(e.target.value)}
            placeholder="+55 11 99999-9999"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-texto">Abre às (hora)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={abre}
              onChange={(e) => setAbre(Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-texto">Fecha às (hora)</span>
            <input
              type="number"
              min={1}
              max={24}
              value={fecha}
              onChange={(e) => setFecha(Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </div>
        <p className="text-xs text-texto-suave">
          A IA não marca depois do fechamento. Ex.: fecha às 18 → serviço de 1h vai no máx. às 17h.
        </p>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar
        </button>
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-marca">
            <Check size={16} /> Salvo
          </span>
        )}
      </div>
    </form>
  );
}
