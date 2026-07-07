"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { crmBrowser } from "@/lib/supabase/browser";
import { Logo } from "@/components/Logo";
import { cadastroPublico } from "@/lib/cadastro/actions";
import type { PlanoPublico } from "@/lib/cadastro/data";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const inputCls =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function CadastroForm({
  planos,
  planoInicial,
}: {
  planos: PlanoPublico[];
  planoInicial: string;
}) {
  const router = useRouter();
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [nomeDono, setNomeDono] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [plano, setPlano] = useState(planoInicial);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await cadastroPublico({ nomeNegocio, nomeDono, email, senha, telefone, plano });
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível criar a conta.");
        setCarregando(false);
        return;
      }
      // Auto-login: a conta já existe (a senha que a pessoa acabou de definir).
      await crmBrowser.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }).catch(() => null);
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl; // vai pro pagamento
      } else {
        router.push("/painel");
        router.refresh();
      }
    } catch {
      setErro("Falha inesperada. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-escuro-quente px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo variante="lockup" tom="branco" height={38} />
        </div>

        <div className="rounded-2xl bg-superficie p-6 shadow-2xl sm:p-8">
          <h1 className="font-corpo text-2xl font-bold text-texto">Crie sua conta</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Preencha, escolha o plano e ative sua máquina de vendas em minutos.
          </p>

          <form onSubmit={enviar} className="mt-6 space-y-5">
            {/* Planos */}
            {planos.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-texto">Escolha o plano</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {planos.map((p) => {
                    const sel = plano === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlano(p.id)}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          sel ? "border-marca bg-marca-suave/40" : "border-borda bg-fundo hover:border-marca/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-corpo text-sm font-bold text-texto">{p.nome}</span>
                          {sel && <Check size={16} className="text-marca" />}
                        </div>
                        {p.mensalCents > 0 && (
                          <div className="mt-1 text-lg font-bold text-texto">
                            {brl(p.mensalCents)}
                            <span className="text-xs font-medium text-texto-suave">/mês</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-texto">Nome do negócio</label>
                <input value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} required className={inputCls} placeholder="Ex.: Clínica Sorriso" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-texto">Seu nome</label>
                <input value={nomeDono} onChange={(e) => setNomeDono(e.target.value)} required className={inputCls} placeholder="Seu nome" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-texto">WhatsApp</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} placeholder="(11) 90000-0000" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-texto">E-mail de acesso</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="voce@empresa.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-texto">Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required className={inputCls} placeholder="mínimo 6 caracteres" />
              </div>
            </div>

            {erro && (
              <p className="text-sm font-medium text-red-600">
                {erro}{" "}
                {/já existe/i.test(erro) && (
                  <a href="/login" className="underline">
                    Ir para o login
                  </a>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {carregando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {carregando ? "Criando sua conta…" : "Criar conta e ir para o pagamento"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-texto-suave">
            Já tem conta?{" "}
            <a href="/login" className="font-semibold text-marca underline">
              Entrar
            </a>
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-texto-suave">
            Ao criar a conta, você concorda com os{" "}
            <a href="/termos" className="text-marca underline">Termos de Uso</a> e a{" "}
            <a href="/privacidade" className="text-marca underline">Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
