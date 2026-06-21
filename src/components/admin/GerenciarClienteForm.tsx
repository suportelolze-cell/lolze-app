"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { atualizarCliente } from "@/lib/admin/actions";
import type { Cliente } from "@/lib/admin/data";

type PlanoOpt = { id: string; nome: string; canaisMax: number };

const CANAIS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "messenger", label: "Messenger" },
  { id: "site", label: "Site / Webchat" },
  { id: "telegram", label: "Telegram" },
];

const STATUS = [
  { id: "ativo", label: "Ativo" },
  { id: "trial", label: "Trial" },
  { id: "suspenso", label: "Suspenso" },
  { id: "cancelado", label: "Cancelado" },
];

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function GerenciarClienteForm({
  cliente,
  planos,
}: {
  cliente: Cliente;
  planos: PlanoOpt[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(cliente.nome);
  const [plano, setPlano] = useState(cliente.plano);
  const [status, setStatus] = useState(cliente.status);
  const [canais, setCanais] = useState<string[]>(cliente.canais ?? []);
  const [contatoEmail, setContatoEmail] = useState(cliente.contatoEmail ?? "");
  const [contatoTelefone, setContatoTelefone] = useState(cliente.contatoTelefone ?? "");
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  function toggleCanal(id: string) {
    setCanais((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await atualizarCliente(cliente.id, {
        nome,
        plano,
        status,
        canais,
        contatoEmail,
        contatoTelefone,
        observacoes,
      });
      setSalvo(true);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5 rounded-xl border border-borda bg-superficie p-6">
      <Campo label="Nome do negócio">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="Plano">
          <select value={plano} onChange={(e) => setPlano(e.target.value)} className={inputCls}>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Canais ativos">
        <div className="flex flex-wrap gap-2">
          {CANAIS.map((c) => {
            const on = canais.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCanal(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  on
                    ? "border-marca bg-marca-suave/50 text-marca"
                    : "border-borda text-texto-suave hover:border-marca"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="E-mail de contato">
          <input
            value={contatoEmail}
            onChange={(e) => setContatoEmail(e.target.value)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input
            value={contatoTelefone}
            onChange={(e) => setContatoTelefone(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo label="Observações internas">
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </Campo>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center justify-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar alterações
        </button>
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-marca">
            <Check size={16} /> Salvo
          </span>
        )}
      </div>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-texto">{label}</span>
      {children}
    </label>
  );
}
