"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { crmBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui";
import { AuthShell, authInputCls } from "@/components/auth/AuthShell";

export default function ResetPage() {
  const router = useRouter();
  // null = verificando; true = há sessão de recuperação; false = link inválido/expirado
  const [pronto, setPronto] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let vivo = true;
    // O callback já trocou o code por sessão (cookie). Confirmamos que existe.
    crmBrowser.auth.getUser().then(({ data }) => {
      if (vivo && data.user) setPronto(true);
      else if (vivo) setPronto(false);
    });
    // Fallback: se o token vier no fragmento (fluxo implícito), o cliente dispara
    // PASSWORD_RECOVERY ao detectar a sessão na URL.
    const { data: sub } = crmBrowser.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") setPronto(true);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) {
      setErro("Use pelo menos 8 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErro("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { error } = await crmBrowser.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      setErro("Não foi possível salvar. O link pode ter expirado. Peça um novo.");
      return;
    }
    setOk(true);
    setTimeout(() => {
      router.push("/painel");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthShell titulo="Criar nova senha" subtitulo="Escolha uma senha forte para a sua conta.">
      {pronto === null ? (
        <div className="mt-8 flex justify-center py-2">
          <Loader2 size={22} className="animate-spin text-texto-suave" />
        </div>
      ) : pronto === false ? (
        <div className="mt-6 space-y-4 text-center">
          <p className="text-sm leading-relaxed text-texto">
            Este link é inválido ou expirou. Peça um novo para redefinir a senha.
          </p>
          <a
            href="/auth/forgot"
            className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-marca hover:text-marca-escura"
          >
            <ArrowLeft size={14} /> Pedir novo link
          </a>
        </div>
      ) : ok ? (
        <div className="mt-6 space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-suave text-marca">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-sm font-semibold text-texto">Senha alterada! Entrando...</p>
        </div>
      ) : (
        <form onSubmit={salvar} className="mt-6 space-y-4">
          <div>
            <label htmlFor="senha" className="mb-1.5 block text-sm font-semibold text-texto">
              Nova senha
            </label>
            <input
              id="senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className={authInputCls}
            />
          </div>
          <div>
            <label htmlFor="senha2" className="mb-1.5 block text-sm font-semibold text-texto">
              Confirmar nova senha
            </label>
            <input
              id="senha2"
              type="password"
              required
              autoComplete="new-password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="••••••••"
              className={authInputCls}
            />
          </div>

          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

          <Button type="submit" disabled={carregando} className="w-full">
            <KeyRound size={16} />
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
