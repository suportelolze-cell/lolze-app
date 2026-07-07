"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crmBrowser } from "@/lib/supabase/browser";
import { Logo } from "@/components/Logo";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const { error } = await crmBrowser.auth.signInWithPassword({
      email,
      password: senha,
    });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-escuro-quente px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variante="lockup" tom="branco" height={40} />
        </div>

        <div className="rounded-lg bg-superficie p-8 shadow-2xl">
          <h1 className="font-corpo text-xl font-bold text-texto">
            Acesse seu Centro de Comando
          </h1>
          <p className="mt-1 text-sm text-texto-suave">
            Entre para ver sua máquina de vendas em tempo real.
          </p>

          <form onSubmit={entrar} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-texto">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-texto">
                Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
              />
            </div>

            {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-2.5 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              <LogIn size={16} />
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-texto-suave">
            Não tem conta?{" "}
            <a href="/cadastro" className="font-semibold text-marca underline">
              Criar conta
            </a>
          </p>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-texto-suave">
            Ao entrar, você concorda com os{" "}
            <a href="/termos" className="text-marca underline">Termos de Uso</a> e a{" "}
            <a href="/privacidade" className="text-marca underline">
              Política de Privacidade
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
