"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { crmBrowser } from "@/lib/supabase/browser";
import { Button, Acento } from "@/components/ui";
import { AuthShell, authInputCls } from "@/components/auth/AuthShell";

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
    const { error } = await crmBrowser.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <AuthShell
      titulo={
        <>
          Acesse seu <Acento>centro de comando</Acento>
        </>
      }
      subtitulo="Entre para ver sua máquina de vendas em tempo real."
    >
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
            className={authInputCls}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="senha" className="block text-sm font-semibold text-texto">
              Senha
            </label>
            <a href="/auth/forgot" className="text-xs font-semibold text-marca hover:text-marca-escura">
              Esqueci a senha
            </a>
          </div>
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className={authInputCls}
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
        <a href="/auth/register" className="font-semibold text-marca hover:text-marca-escura">
          Criar conta
        </a>
      </p>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-texto-suave">
        Ao entrar, você concorda com os{" "}
        <a href="/termos" className="text-marca hover:underline">Termos de Uso</a> e a{" "}
        <a href="/privacidade" className="text-marca hover:underline">Política de Privacidade</a>.
      </p>
    </AuthShell>
  );
}
