"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { getEntregaPadrao, salvarEntregaPadrao } from "@/lib/checkout/entrega-actions";

export function EntregaCard() {
  const [carregado, setCarregado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getEntregaPadrao();
      if (!r.ok) setErro(r.erro ?? "Não foi possível carregar.");
      setMensagem(r.mensagem);
      setAtivo(r.ativo);
      setPendente(r.migracaoPendente);
      setCarregado(true);
    })();
  }, []);

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    const r = await salvarEntregaPadrao({ mensagem, ativo });
    setSalvando(false);
    if (!r.ok) {
      window.alert(r.erro ?? "Não foi possível salvar.");
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (!carregado) {
    return (
      <p className="flex items-center gap-2 text-xs text-texto-suave">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-texto-suave">
        Quando uma compra é aprovada, o cliente recebe esta mensagem com o acesso (link da área de
        membros, grupo, instruções). Só é enviada para quem tem WhatsApp/Instagram no contato.
      </p>

      {pendente && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          A tabela de entregas ainda não foi criada no banco. Você pode escrever a mensagem, mas ela
          só passa a valer depois de aplicar a migração.
        </p>
      )}
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={5}
        maxLength={4000}
        placeholder={"Ex.: Seu acesso chegou! 🎉\nEntre em https://area.exemplo.com com o e-mail da compra.\nGrupo de alunos: https://..."}
        className="w-full resize-y rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-texto">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Enviar entrega automática
        </label>
        <Button
          variant={salvo ? "verde" : "primary"}
          size="sm"
          onClick={salvar}
          disabled={salvando}
          className="ml-auto"
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
          {salvo ? "Salvo!" : "Salvar mensagem de entrega"}
        </Button>
      </div>
    </div>
  );
}
