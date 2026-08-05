"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crmBrowser } from "@/lib/supabase/browser";
import { Logo } from "@/components/Logo";
import { LogIn } from "lucide-react";
import { Button, Card, Acento } from "@/components/ui";

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

  const inputCls =
    "w-full rounded-md border border-borda bg-fundo px-3.5 py-2.5 text-sm text-texto outline-none transition-colors focus:border-marca";

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 50% 22%, rgba(46,167,97,.12), transparent 32%), var(--fundo)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variante="lockup" tom="escuro" height={40} />
        </div>

        <Card className="p-8">
          <h1 className="font-corpo text-2xl font-semibold -tracking-[0.02em] text-texto">
            Acesse seu <Acento>centro de comando</Acento>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
            Entre para ver sua máquina de vendas em tempo real.
          </p>

          <form onSubmit={entrar} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-texto">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="senha" className="mb-1.5 block text-sm font-semibold text-texto">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

            <Button type="submit" disabled={carregando} className="w-full">
              <LogIn size={16} />
              {carregando ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-texto-suave">
            Não tem conta?{" "}
            <a href="/cadastro" className="font-semibold text-marca hover:text-marca-escura">
              Criar conta
            </a>
          </p>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-texto-suave">
            Ao entrar, você concorda com os{" "}
            <a href="/termos" className="text-marca hover:underline">Termos de Uso</a> e a{" "}
            <a href="/privacidade" className="text-marca hover:underline">
              Política de Privacidade
            </a>
            .
          </p>
        </Card>
      </div>
    </main>
  );
}
