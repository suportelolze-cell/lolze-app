"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, CheckCircle2, Copy } from "lucide-react";
import { criarCliente } from "@/lib/admin/actions";

type PlanoOpt = { id: string; nome: string; canaisMax: number };

const CANAIS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "messenger", label: "Messenger" },
  { id: "site", label: "Site / Webchat" },
  { id: "telegram", label: "Telegram" },
];

function gerarSenha() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function NovoClienteForm({ planos, semKey }: { planos: PlanoOpt[]; semKey: boolean }) {
  const router = useRouter();
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [plano, setPlano] = useState(planos[0]?.id ?? "start");
  const [nomeDono, setNomeDono] = useState("");
  const [emailDono, setEmailDono] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [canais, setCanais] = useState<string[]>(["whatsapp"]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState<{ email: string; senha: string } | null>(null);

  function toggleCanal(id: string) {
    setCanais((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await criarCliente({
        nomeNegocio,
        plano,
        nomeDono,
        emailDono,
        telefone,
        senha,
        canais,
      });
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível cadastrar.");
      } else {
        setSucesso({ email: r.email!, senha: r.senha! });
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="rounded-xl border border-marca/30 bg-marca-suave/40 p-6">
        <CheckCircle2 className="text-marca" size={28} />
        <h2 className="mt-3 font-corpo text-lg font-bold text-texto">Cliente criado!</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Entregue estas credenciais ao cliente. A senha não será mostrada de novo.
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-borda bg-superficie p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-texto-suave">E-mail</span>
            <strong className="text-texto">{sucesso.email}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-texto-suave">Senha</span>
            <strong className="text-texto">{sucesso.senha}</strong>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => navigator.clipboard.writeText(`E-mail: ${sucesso.email}\nSenha: ${sucesso.senha}`)}
            className="flex items-center gap-1.5 rounded-sm border border-borda px-4 py-2 text-sm font-semibold text-texto hover:border-marca"
          >
            <Copy size={15} /> Copiar
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="rounded-sm bg-marca px-4 py-2 text-sm font-semibold text-bege-principal"
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5 rounded-xl border border-borda bg-superficie p-6">
      {semKey && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A chave <code className="rounded bg-amber-100 px-1">SUPABASE_CRM_SERVICE_KEY</code> não
          está configurada. O cadastro vai falhar até você adicioná-la no{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>.
        </div>
      )}

      <Campo label="Nome do negócio">
        <input
          required
          value={nomeNegocio}
          onChange={(e) => setNomeNegocio(e.target.value)}
          placeholder="Ex.: Clínica Sorria Mais"
          className={inputCls}
        />
      </Campo>

      <Campo label="Plano">
        <select value={plano} onChange={(e) => setPlano(e.target.value)} className={inputCls}>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.canaisMax} {p.canaisMax > 1 ? "canais" : "canal"})
            </option>
          ))}
        </select>
      </Campo>

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
        <Campo label="Nome do dono">
          <input
            value={nomeDono}
            onChange={(e) => setNomeDono(e.target.value)}
            placeholder="Ex.: Dra. Helena"
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(19) 9 9999-9999"
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo label="E-mail de acesso do dono">
        <input
          required
          type="email"
          value={emailDono}
          onChange={(e) => setEmailDono(e.target.value)}
          placeholder="dono@empresa.com"
          className={inputCls}
        />
      </Campo>

      <Campo label="Senha inicial">
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
            className="flex items-center gap-1.5 rounded-sm border border-borda px-3 text-sm font-semibold text-texto hover:border-marca"
          >
            <RefreshCw size={15} /> Gerar
          </button>
        </div>
      </Campo>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="flex w-full items-center justify-center gap-2 rounded-sm bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
      >
        {carregando ? <Loader2 size={16} className="animate-spin" /> : null}
        Cadastrar cliente
      </button>
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
