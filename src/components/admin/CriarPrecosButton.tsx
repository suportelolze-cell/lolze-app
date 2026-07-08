"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Check } from "lucide-react";
import { criarPrecosStripe } from "@/lib/billing/actions";

export function CriarPrecosButton({ faltando }: { faltando: number }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);

  async function criar() {
    setCarregando(true);
    setMsg("");
    setErro(false);
    const r = await criarPrecosStripe();
    setCarregando(false);
    if (r.ok) {
      setMsg(`${r.criados} preço(s) criado(s) no Stripe. A cobrança está ativa.`);
      router.refresh();
    } else {
      setErro(true);
      setMsg(r.erro ?? "Falha ao criar os preços.");
    }
  }

  if (faltando <= 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-marca">
        <Check size={15} /> Todos os planos já têm preço no Stripe — cobrança ativa.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm text-amber-800">
        {faltando} plano(s) ainda sem preço no Stripe — o cadastro/pagamento não cobra até criar.
      </p>
      <button
        onClick={criar}
        disabled={carregando}
        className="mt-3 flex items-center gap-2 rounded-md bg-marca px-4 py-2 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {carregando ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {carregando ? "Criando no Stripe…" : "Criar preços no Stripe"}
      </button>
      {msg && (
        <p className={`mt-2 text-sm font-medium ${erro ? "text-red-600" : "text-marca"}`}>{msg}</p>
      )}
    </div>
  );
}
