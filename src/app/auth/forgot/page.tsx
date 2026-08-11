"use client";

import { useState } from "react";
import { Mail, ArrowLeft, MailCheck } from "lucide-react";
import { crmBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui";
import { AuthShell, authInputCls } from "@/components/auth/AuthShell";
import { ROTAS } from "@/lib/rotas";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const redirectTo = `${window.location.origin}${ROTAS.auth.callback}?next=${ROTAS.auth.reset}`;
    // Não tratamos o erro de forma diferente: sempre mostramos "enviado" para
    // não revelar se o e-mail existe (evita enumeração de contas).
    await crmBrowser.auth.resetPasswordForEmail(email, { redirectTo });
    setCarregando(false);
    setEnviado(true);
  }

  return (
    <AuthShell
      titulo="Recuperar acesso"
      subtitulo="Enviaremos um link para você criar uma nova senha."
    >
      {enviado ? (
        <div className="mt-6 space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-suave text-marca">
            <MailCheck size={22} />
          </div>
          <p className="text-sm leading-relaxed text-texto">
            Se existir uma conta com <b>{email}</b>, o link de recuperação já está a caminho.
            Confira a caixa de entrada (e o spam).
          </p>
          <a
            href={ROTAS.auth.login}
            className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-marca hover:text-marca-escura"
          >
            <ArrowLeft size={14} /> Voltar para o login
          </a>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-texto">
              E-mail da conta
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

          <Button type="submit" disabled={carregando} className="w-full">
            <Mail size={16} />
            {carregando ? "Enviando..." : "Enviar link de recuperação"}
          </Button>

          <a
            href={ROTAS.auth.login}
            className="flex items-center justify-center gap-1 text-sm font-semibold text-texto-suave hover:text-texto"
          >
            <ArrowLeft size={14} /> Voltar para o login
          </a>
        </form>
      )}
    </AuthShell>
  );
}
