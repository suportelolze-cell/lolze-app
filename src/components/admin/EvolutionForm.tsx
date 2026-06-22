"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Loader2, Check } from "lucide-react";
import { salvarEvolutionCfg } from "@/lib/admin/actions";
import type { EvolutionCfg } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function EvolutionForm({ tenantId, cfg }: { tenantId: string; cfg: EvolutionCfg }) {
  const router = useRouter();
  const [instance, setInstance] = useState(cfg.instance);
  const [n8nInbound, setN8nInbound] = useState(cfg.n8nInbound);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await salvarEvolutionCfg(tenantId, { instance, n8nInbound });
      setSalvo(true);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">WhatsApp (Evolution)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        O cliente conecta o WhatsApp sozinho (QR) em Configurações. Aqui você define a instância e a
        entrada do n8n.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">Nome da instância</span>
          <input
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            placeholder="deixe vazio para o app criar automático"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-texto-suave">
            Para reusar uma instância existente, digite o nome dela (ex.: <code>agenteia</code>).
            Vazio = o app cria uma nova no primeiro QR.
          </p>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            URL de entrada do n8n (Gatilho WPP)
          </span>
          <input
            value={n8nInbound}
            onChange={(e) => setN8nInbound(e.target.value)}
            placeholder="https://seu-n8n/webhook/agente_mestre"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-texto-suave">
            Production URL do nó <b>Gatilho [WPP]</b>. O app configura esse webhook ao criar a
            instância, para as mensagens recebidas fluírem pro n8n.
          </p>
        </label>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar
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
