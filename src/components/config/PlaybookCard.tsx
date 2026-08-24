"use client";

import { useEffect, useState } from "react";
import { Loader2, Store, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui";
import { getPlaybook, salvarPlaybook, type Playbook } from "@/lib/agent/playbook-actions";

const OPCOES: { valor: Playbook; titulo: string; desc: string; icon: typeof Store }[] = [
  {
    valor: "servico_local",
    titulo: "Serviço / negócio local",
    desc: "Agenda e atendimento presencial: o SDR qualifica, coleta endereço e marca horário.",
    icon: Store,
  },
  {
    valor: "infoproduto",
    titulo: "Produtor de infoproduto",
    desc: "Venda por checkout: o SDR leva à compra, ajuda a recuperar pagamento pendente e dá suporte de acesso. Agenda só em ticket alto.",
    icon: GraduationCap,
  },
];

export function PlaybookCard() {
  const [atual, setAtual] = useState<Playbook | null>(null);
  const [escolha, setEscolha] = useState<Playbook>("servico_local");
  const [erro, setErro] = useState("");
  const [pendente, setPendente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function carregar() {
    const r = await getPlaybook();
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível carregar.");
      setAtual("servico_local");
      return;
    }
    setAtual(r.playbook);
    setEscolha(r.playbook);
    setPendente(r.migracaoPendente);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    const r = await salvarPlaybook(escolha);
    setSalvando(false);
    if (!r.ok) {
      window.alert(r.erro ?? "Não foi possível salvar.");
      return;
    }
    setAtual(escolha);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (atual === null) {
    return (
      <p className="flex items-center gap-2 text-xs text-texto-suave">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-texto-suave">
        Escolha o tipo de operação. Isso ajusta como o agente de IA conduz a conversa (o motor é o
        mesmo, muda o roteiro).
      </p>

      {pendente && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          A migração que habilita o playbook ainda não foi aplicada no banco. Você pode escolher, mas
          só passa a valer depois de aplicar a migração.
        </p>
      )}
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {OPCOES.map(({ valor, titulo, desc, icon: Icon }) => {
          const ativo = escolha === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setEscolha(valor)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                ativo
                  ? "border-marca bg-marca-suave/50"
                  : "border-borda bg-superficie hover:border-marca"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} className={ativo ? "text-marca" : "text-texto-suave"} />
                <span className="text-sm font-bold text-texto">{titulo}</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-texto-suave">{desc}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button variant={salvo ? "verde" : "primary"} size="sm" onClick={salvar} disabled={salvando || escolha === atual}>
          {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
          {salvo ? "Salvo!" : "Salvar tipo de operação"}
        </Button>
        {escolha !== atual && !salvo && (
          <span className="text-xs text-texto-suave">Alteração não salva</span>
        )}
      </div>
    </div>
  );
}
