"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { criarLeadManual } from "@/lib/supabase/crm-actions";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm text-texto outline-none focus:border-marca";

export function NovoLeadButton() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const r = await criarLeadManual({ nome, telefone });
      if (r.ok) {
        setNome("");
        setTelefone("");
        setAberto(false);
        router.refresh();
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
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-sm bg-marca px-5 py-2.5 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02] no-print"
      >
        <Plus size={18} /> Adicionar Lead Manualmente
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={salvar}
            className="w-full max-w-sm space-y-4 rounded-xl border border-borda bg-superficie p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-corpo text-lg font-bold text-texto">Novo lead</h2>
              <button type="button" onClick={() => setAberto(false)} className="text-texto-suave hover:text-texto">
                <X size={18} />
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-texto">Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-texto">Telefone / WhatsApp</span>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="+55 ..." className={inputCls} />
            </label>

            {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} className="rounded-sm border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-2 rounded-sm bg-marca px-5 py-2 text-sm font-bold text-bege-principal disabled:opacity-50"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : null} Adicionar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
