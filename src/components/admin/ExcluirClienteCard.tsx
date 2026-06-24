"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { excluirCliente } from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-lg border border-red-300 bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-red-500";

export function ExcluirClienteCard({
  tenantId,
  nome,
}: {
  tenantId: string;
  nome: string;
}) {
  const router = useRouter();
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const habilitado = confirmacao.trim() === nome;

  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!habilitado) return;
    const ok = window.confirm(
      `Excluir DEFINITIVAMENTE a conta de "${nome}"?\n\nIsso apaga o login (Auth), os usuários, leads, conversas, agendamentos, base de conhecimento e configurações. NÃO há como desfazer.`
    );
    if (!ok) return;

    setExcluindo(true);
    try {
      const r = await excluirCliente(tenantId, confirmacao);
      if (r.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErro(r.erro ?? "Falha ao excluir a conta.");
        setExcluindo(false);
      }
    } catch (err) {
      setErro((err as Error).message);
      setExcluindo(false);
    }
  }

  return (
    <form onSubmit={excluir} className="rounded-xl border border-red-300 bg-red-50/40 p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-600" />
        <h2 className="font-corpo text-lg font-bold text-red-700">Zona de perigo — Excluir conta</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Exclui <strong>permanentemente</strong> a conta deste cliente do SaaS: usuários (login no
        Auth), leads, conversas, agendamentos, base de conhecimento, integrações e configurações.
        Esta ação <strong>não pode ser desfeita</strong>.
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-texto">
          Para confirmar, digite o nome do negócio: <span className="text-red-700">{nome}</span>
        </span>
        <input
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={nome}
          className={inputCls}
          autoComplete="off"
        />
      </label>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5">
        <button
          type="submit"
          disabled={excluindo || !habilitado}
          className="flex items-center gap-2 rounded-sm bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {excluindo ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Excluir conta permanentemente
        </button>
      </div>
    </form>
  );
}
