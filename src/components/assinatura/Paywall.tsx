"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, RefreshCw, LogOut, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { crmBrowser } from "@/lib/supabase/browser";
import { assinarPlano, gerenciarAssinatura } from "@/lib/billing/actions";
import type { BillingInfo } from "@/lib/billing/data";

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function Paywall({ billing, papel }: { billing: BillingInfo; papel: string }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const ehDono = papel === "owner" || papel === "superadmin";
  const inadimplente = billing.status === "inadimplente";

  const titulo = inadimplente
    ? "Pagamento pendente"
    : billing.status === "cancelado"
      ? "Assinatura cancelada"
      : "Ative sua conta";
  const msg = inadimplente
    ? "Houve um problema com o seu pagamento. Atualize os dados para reativar o acesso."
    : billing.status === "cancelado"
      ? "Sua assinatura foi cancelada. Reative para voltar a usar a Lolze."
      : "Sua conta está criada! Finalize a assinatura para liberar o acesso completo.";

  async function ir(promessa: Promise<{ url?: string; erro?: string }>) {
    setErro("");
    setCarregando(true);
    const r = await promessa;
    if (r.url) {
      window.location.href = r.url;
    } else {
      setErro(r.erro ?? "Não foi possível continuar.");
      setCarregando(false);
    }
  }

  async function sair() {
    await crmBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-escuro-quente px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo variante="lockup" tom="branco" height={38} />
        </div>

        <div className="rounded-2xl bg-superficie p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-marca-suave text-marca">
            <Lock size={24} />
          </div>
          <h1 className="mt-4 font-corpo text-xl font-bold text-texto">{titulo}</h1>
          <p className="mt-2 text-sm text-texto-suave">{msg}</p>
          {billing.planoNome && (
            <p className="mt-3 text-sm text-texto">
              Plano <b>{billing.planoNome}</b>
              {billing.mensalCents > 0 && <> · {brl(billing.mensalCents)}/mês</>}
            </p>
          )}

          {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

          <div className="mt-6 space-y-3">
            {ehDono ? (
              inadimplente && billing.temAssinatura ? (
                <button
                  onClick={() => ir(gerenciarAssinatura())}
                  disabled={carregando}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {carregando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Atualizar pagamento
                </button>
              ) : billing.temCheckout ? (
                <button
                  onClick={() => ir(assinarPlano())}
                  disabled={carregando}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {carregando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Assinar agora
                </button>
              ) : (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Pagamento online ainda não habilitado. Fale com o suporte:{" "}
                  <a href="mailto:suporte.lolze@gmail.com" className="font-semibold underline">
                    suporte.lolze@gmail.com
                  </a>
                </p>
              )
            ) : (
              <p className="rounded-md bg-fundo px-3 py-2 text-sm text-texto-suave">
                A sua empresa está com o pagamento pendente. Fale com o responsável pela conta.
              </p>
            )}

            <button
              onClick={() => router.refresh()}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-texto-suave hover:text-texto"
            >
              <RefreshCw size={13} /> Já paguei — atualizar
            </button>
            <button
              onClick={sair}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-texto-suave hover:text-texto"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
