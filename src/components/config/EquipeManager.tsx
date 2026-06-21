"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2, RefreshCw, Copy, CheckCircle2, X } from "lucide-react";
import { adicionarMembro, removerMembro } from "@/lib/team/actions";
import type { EquipeInfo } from "@/lib/team/data";

function gerarSenha() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

const inputCls =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function EquipeManager({ info }: { info: EquipeInfo }) {
  const router = useRouter();
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);

  const lotado = info.sdrAtivos >= info.sdrMax;
  const owner = info.membros.find((m) => m.papel === "owner");
  const sdrs = info.membros.filter((m) => m.papel === "membro" || m.papel === "sdr");

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await adicionarMembro({ nome, email, senha });
      if (!r.ok) setErro(r.erro ?? "Não foi possível adicionar.");
      else {
        setCriado({ email: r.email!, senha: r.senha! });
        setNome("");
        setEmail("");
        setSenha(gerarSenha());
        setFormAberto(false);
        router.refresh();
      }
    } finally {
      setCarregando(false);
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Remover ${nome}? O acesso dele será excluído e a vaga liberada.`)) return;
    const r = await removerMembro(id);
    if (!r.ok) setErro(r.erro ?? "Não foi possível remover.");
    else router.refresh();
  }

  return (
    <div className="rounded-lg border border-borda bg-superficie p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-corpo text-lg font-bold text-texto">Usuários e Permissões</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Adicione seus vendedores (SDRs) que vão atender no painel.
          </p>
        </div>
        {info.sdrMax > 0 && (
          <div className="rounded-md bg-fundo px-3 py-2 text-right">
            <p className="text-sm font-bold text-texto">
              {info.sdrAtivos} <span className="font-normal text-texto-suave">de</span>{" "}
              {info.sdrMax} SDRs
            </p>
            <p className="text-[11px] text-texto-suave">Plano {info.planoNome}</p>
          </div>
        )}
      </div>

      {criado && (
        <div className="mt-5 rounded-lg border border-marca/30 bg-marca-suave/40 p-4">
          <div className="flex items-center gap-2 text-marca">
            <CheckCircle2 size={18} /> <strong className="text-texto">SDR adicionado!</strong>
          </div>
          <p className="mt-1 text-sm text-texto-suave">Entregue o acesso ao vendedor:</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-texto-suave">E-mail:</span>{" "}
              <strong className="text-texto">{criado.email}</strong>
            </span>
            <span>
              <span className="text-texto-suave">Senha:</span>{" "}
              <strong className="text-texto">{criado.senha}</strong>
            </span>
            <button
              onClick={() =>
                navigator.clipboard.writeText(`E-mail: ${criado.email}\nSenha: ${criado.senha}`)
              }
              className="flex items-center gap-1 text-xs font-semibold text-marca"
            >
              <Copy size={13} /> copiar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {owner && (
          <MembroRow nome={owner.nome} email={owner.email} papel="Dono / Gestor" inicial />
        )}
        {sdrs.map((m) => (
          <MembroRow
            key={m.id}
            nome={m.nome}
            email={m.email}
            papel="Atendimento / SDR"
            onRemover={info.podeGerenciar ? () => remover(m.id, m.nome) : undefined}
          />
        ))}
        {sdrs.length === 0 && (
          <p className="py-3 text-center text-xs italic text-texto-suave">
            Nenhum SDR cadastrado ainda.
          </p>
        )}
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      {/* Adicionar */}
      {info.podeGerenciar && (
        <div className="mt-4">
          {!formAberto ? (
            <button
              onClick={() => {
                setErro("");
                if (lotado) {
                  setErro(
                    `Limite de ${info.sdrMax} SDRs do plano ${info.planoNome} atingido. Remova um membro para adicionar outro.`
                  );
                } else {
                  setFormAberto(true);
                }
              }}
              className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-transform ${
                lotado
                  ? "cursor-not-allowed bg-fundo text-texto-suave"
                  : "bg-marca text-bege-principal hover:scale-[1.02]"
              }`}
            >
              <UserPlus size={16} /> Adicionar SDR
            </button>
          ) : (
            <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-borda bg-fundo p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-texto">Novo SDR</h3>
                <button type="button" onClick={() => setFormAberto(false)} aria-label="Fechar">
                  <X size={16} className="text-texto-suave" />
                </button>
              </div>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do vendedor"
                className={inputCls}
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                className={inputCls}
              />
              <div className="flex gap-2">
                <input
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setSenha(gerarSenha())}
                  className="flex items-center gap-1.5 rounded-md border border-borda px-3 text-sm font-semibold text-texto hover:border-marca"
                >
                  <RefreshCw size={14} /> Gerar
                </button>
              </div>
              <button
                type="submit"
                disabled={carregando}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-marca py-2.5 text-sm font-bold text-bege-principal disabled:opacity-50"
              >
                {carregando ? <Loader2 size={15} className="animate-spin" /> : null}
                Criar acesso do SDR
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function MembroRow({
  nome,
  email,
  papel,
  inicial,
  onRemover,
}: {
  nome: string;
  email: string;
  papel: string;
  inicial?: boolean;
  onRemover?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-borda bg-fundo px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-escuro-quente text-sm font-bold text-bege-principal">
          {(nome[0] || "?").toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-semibold text-texto">{nome}</p>
          <p className="text-xs text-texto-suave">
            {papel} · {email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            inicial ? "bg-escuro-quente/10 text-texto" : "bg-marca-suave text-marca"
          }`}
        >
          {inicial ? "Gestor" : "Ativo"}
        </span>
        {onRemover && (
          <button
            onClick={onRemover}
            aria-label="Remover"
            className="rounded-md p-1.5 text-texto-suave transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
