"use client";

import { useState } from "react";
import { Copy, RefreshCw, ArrowDownToLine, Loader2, Lock } from "lucide-react";
import { regenerarToken } from "@/lib/admin/actions";

const boxCls =
  "flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm";

export function IngestForm({
  tenantId,
  endpoint,
  tokenInicial,
}: {
  tenantId: string;
  endpoint: string;
  tokenInicial: string;
}) {
  const [token, setToken] = useState(tokenInicial);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState("");

  function copiar(valor: string, tag: string) {
    navigator.clipboard.writeText(valor);
    setCopiado(tag);
    setTimeout(() => setCopiado(""), 1500);
  }

  async function regenerar() {
    if (
      !confirm(
        "Gerar um novo token invalida o atual. O n8n desse cliente vai parar de gravar até você atualizar o token lá. Continuar?"
      )
    )
      return;
    setCarregando(true);
    try {
      const novo = await regenerarToken(tenantId);
      setToken(novo);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <ArrowDownToLine size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Entrada do n8n (ingestão)</h2>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave">
        <Lock size={13} /> Configure no n8n deste cliente. Visível apenas para o admin.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-texto">Endpoint (URL)</span>
          <div className={boxCls}>
            <code className="min-w-0 flex-1 truncate text-texto-suave">{endpoint}</code>
            <button
              type="button"
              onClick={() => copiar(endpoint, "url")}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-marca"
            >
              <Copy size={13} /> {copiado === "url" ? "copiado" : "copiar"}
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-texto">
            Token do cliente (Bearer)
          </span>
          <div className={boxCls}>
            <code className="min-w-0 flex-1 truncate text-texto-suave">{token}</code>
            <button
              type="button"
              onClick={() => copiar(token, "tok")}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-marca"
            >
              <Copy size={13} /> {copiado === "tok" ? "copiado" : "copiar"}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-fundo p-3">
          <p className="mb-1 text-xs font-semibold text-texto">No n8n (HTTP Request):</p>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-texto-suave">
{`POST ${endpoint}
Authorization: Bearer ${token.slice(0, 8)}…
{
  "canal": "whatsapp",
  "contato": { "nome": "Maria", "telefone": "5519...", "canal_user_id": "5519..." },
  "mensagem": { "autor": "lead", "texto": "Olá, quero saber preços" }
}`}
          </pre>
        </div>

        <button
          type="button"
          onClick={regenerar}
          disabled={carregando}
          className="flex items-center gap-2 rounded-sm border border-borda px-4 py-2 text-sm font-semibold text-texto transition-colors hover:border-marca disabled:opacity-50"
        >
          {carregando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Gerar novo token
        </button>
      </div>
    </div>
  );
}
