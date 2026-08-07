"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldOff, Loader2 } from "lucide-react";
import { exportarDadosLead, excluirDadosLead } from "@/lib/lgpd/lgpd-actions";

/**
 * Ações de privacidade (LGPD) de UM contato, dentro do "Raio-X do Cliente".
 * Só é renderizado para gestor (a action revalida no servidor de todo jeito).
 */
export function LgpdLeadActions({ leadId, nome }: { leadId: number; nome: string }) {
  const router = useRouter();
  const [baixando, setBaixando] = useState(false);
  const [abrir, setAbrir] = useState(false);
  const [modo, setModo] = useState<"anonimizar" | "excluir">("anonimizar");
  const [confirm, setConfirm] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  async function exportar() {
    setErro("");
    setBaixando(true);
    try {
      const r = await exportarDadosLead(leadId);
      if (!r.ok || !r.json) {
        setErro(r.erro ?? "Falha ao exportar.");
        return;
      }
      const blob = new Blob([r.json], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contato-${leadId}-lgpd.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  async function executar() {
    setErro("");
    if (confirm.trim().toUpperCase() !== "EXCLUIR") {
      setErro("Digite EXCLUIR para confirmar.");
      return;
    }
    setProcessando(true);
    try {
      const r = await excluirDadosLead(leadId, modo);
      if (r.ok) {
        setAbrir(false);
        setConfirm("");
        router.refresh();
      } else {
        setErro(r.erro ?? "Falha ao processar.");
      }
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-lg border border-borda bg-fundo p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
        Privacidade (LGPD)
      </p>
      <p className="mt-1 text-xs leading-relaxed text-texto-suave">
        Atenda um pedido do titular: exporte os dados dele ou remova-os desta conta.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={exportar}
          disabled={baixando}
          className="flex items-center gap-2 rounded-md border border-borda bg-superficie px-3 py-2 text-xs font-semibold text-texto hover:bg-fundo disabled:opacity-50"
        >
          {baixando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar dados (JSON)
        </button>
        <button
          onClick={() => {
            setAbrir((v) => !v);
            setErro("");
          }}
          className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          <ShieldOff size={14} /> Excluir / anonimizar
        </button>
      </div>

      {abrir && (
        <div className="mt-3 space-y-3 rounded-md border border-red-200 bg-red-50/40 p-3">
          <label className="flex items-start gap-2 text-xs text-texto">
            <input
              type="radio"
              name={`modo-${leadId}`}
              checked={modo === "anonimizar"}
              onChange={() => setModo("anonimizar")}
              className="mt-0.5"
            />
            <span>
              <strong>Anonimizar</strong> (recomendado): remove nome, telefone, e-mail, conversas e
              agendamentos, mas mantém o valor das vendas nos seus relatórios, sem identificar a
              pessoa.
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-texto">
            <input
              type="radio"
              name={`modo-${leadId}`}
              checked={modo === "excluir"}
              onChange={() => setModo("excluir")}
              className="mt-0.5"
            />
            <span>
              <strong>Excluir tudo</strong>: apaga o contato e também as vendas dele dos seus
              relatórios. Não há como desfazer.
            </span>
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Digite EXCLUIR para confirmar"
            autoComplete="off"
            className="w-full rounded-md border border-red-300 bg-fundo px-3 py-2 text-xs text-texto outline-none focus:border-red-500"
          />
          <button
            onClick={executar}
            disabled={processando}
            className="flex items-center gap-2 rounded-sm bg-red-600 px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {processando ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
            Confirmar {modo === "excluir" ? "exclusão" : "anonimização"}
          </button>
        </div>
      )}

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
    </div>
  );
}
