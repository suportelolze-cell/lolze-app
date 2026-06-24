"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Check } from "lucide-react";
import { alterarEmailAcesso } from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function AlterarEmailAcesso({
  tenantId,
  emailAtual,
}: {
  tenantId: string;
  emailAtual: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    const novo = email.trim();
    if (!novo) return;
    const ok = window.confirm(
      `Trocar o e-mail de acesso para "${novo}"?\n\nO cliente passará a fazer login com esse e-mail. A senha continua a mesma.`
    );
    if (!ok) return;

    setSalvando(true);
    try {
      const r = await alterarEmailAcesso(tenantId, novo);
      if (r.ok) {
        setSalvo(true);
        setEmail("");
        router.refresh();
      } else {
        setErro(r.erro ?? "Falha ao alterar o e-mail.");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">E-mail de acesso (login)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Troca o e-mail com que o cliente <strong>faz login</strong>. Use quando ele perdeu o
        acesso ao e-mail antigo mas quer manter a mesma conta. A senha não muda.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-texto">E-mail atual</span>
          <p className="rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto-suave">
            {emailAtual || "— sem usuário dono cadastrado —"}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">Novo e-mail de acesso</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="novo@email.com"
            className={inputCls}
            autoComplete="off"
          />
        </label>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando || !email.trim() || !emailAtual}
          className="flex items-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Alterar e-mail de acesso
        </button>
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-marca">
            <Check size={16} /> E-mail alterado
          </span>
        )}
      </div>
    </form>
  );
}
