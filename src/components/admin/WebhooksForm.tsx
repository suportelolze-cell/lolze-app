"use client";

import { useState } from "react";
import { Loader2, Check, Webhook, Lock } from "lucide-react";
import { salvarWebhooks } from "@/lib/admin/actions";
import { CANAIS_WEBHOOK } from "@/lib/admin/canais";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function WebhooksForm({
  tenantId,
  urlsIniciais,
}: {
  tenantId: string;
  urlsIniciais: Record<string, string>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    CANAIS_WEBHOOK.forEach((c) => (base[c.id] = urlsIniciais[c.id] ?? ""));
    return base;
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await salvarWebhooks(tenantId, urls);
      setSalvo(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <Webhook size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Webhooks n8n (agente IA)</h2>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave">
        <Lock size={13} /> Visível e editável apenas pelo administrador. O dono e os SDRs não
        têm acesso a estas URLs.
      </p>

      <div className="mt-5 space-y-4">
        {CANAIS_WEBHOOK.map((c) => (
          <label key={c.id} className="block">
            <span className="mb-1.5 block text-sm font-medium text-texto">{c.label}</span>
            <input
              type="url"
              value={urls[c.id]}
              onChange={(e) => setUrls((u) => ({ ...u, [c.id]: e.target.value }))}
              placeholder="https://n8n.seudominio.com/webhook/..."
              className={inputCls}
            />
          </label>
        ))}
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center justify-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar webhooks
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
