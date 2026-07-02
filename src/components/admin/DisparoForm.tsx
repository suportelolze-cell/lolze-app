"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Plus, Trash2, Loader2, Check } from "lucide-react";
import { salvarDisparoInstancias } from "@/lib/admin/actions";

export function DisparoForm({
  tenantId,
  instancias: iniciais,
  max,
  plano,
}: {
  tenantId: string;
  instancias: string[];
  max: number;
  plano: string;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<string[]>(iniciais);
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const cheio = lista.length >= max;

  function adicionar() {
    const n = nova.trim();
    if (!n) return;
    if (lista.includes(n)) {
      setErro("Essa instância já está na lista.");
      return;
    }
    if (cheio) {
      setErro(`O plano ${plano} libera no máximo ${max} número(s).`);
      return;
    }
    setErro("");
    setLista([...lista, n]);
    setNova("");
  }

  function remover(n: string) {
    setLista(lista.filter((x) => x !== n));
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setSalvo(false);
    const r = await salvarDisparoInstancias(tenantId, lista);
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
      router.refresh();
    } else {
      setErro(r.erro ?? "Falha ao salvar.");
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <Radar size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Números de disparo (Captação)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Cadastre aqui as instâncias Evolution dos chips DEDICADOS de prospecção deste cliente. Elas
        aparecem pra ele escolher na tela de Captação (ele não digita o nome). O plano{" "}
        <b>{plano}</b> libera <b>{max}</b> número(s) — usados: <b>{lista.length}</b>.
      </p>
      <p className="mt-1 text-xs text-texto-suave">
        Lembre: cada instância precisa estar <b>conectada (QR)</b> na Evolution pra funcionar.
      </p>

      <div className="mt-4 space-y-2">
        {lista.length === 0 && (
          <p className="rounded-md bg-fundo px-3 py-2 text-sm text-texto-suave">
            Nenhum número liberado ainda.
          </p>
        )}
        {lista.map((n) => (
          <div key={n} className="flex items-center justify-between gap-3 rounded-md border border-borda bg-fundo px-3 py-2">
            <span className="truncate text-sm font-medium text-texto">{n}</span>
            <button
              onClick={() => remover(n)}
              aria-label="Remover"
              className="shrink-0 text-texto-suave hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionar())}
          placeholder={cheio ? "Limite do plano atingido" : "ex.: cliente-prospeccao-1"}
          disabled={cheio}
          className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca disabled:opacity-50"
        />
        <button
          onClick={adicionar}
          disabled={cheio || !nova.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-marca px-3 py-2 text-sm font-semibold text-marca hover:bg-marca-suave/40 disabled:opacity-50"
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={salvar}
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
    </div>
  );
}
