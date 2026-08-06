"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportarContaTenant } from "@/lib/lgpd/lgpd-actions";

/** Superadmin: baixa o dump completo da conta (sem segredos) — LGPD/portabilidade. */
export function ExportarContaButton({ tenantId, nome }: { tenantId: string; nome: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function baixar() {
    setErro("");
    setCarregando(true);
    try {
      const r = await exportarContaTenant(tenantId);
      if (!r.ok || !r.json) {
        setErro(r.erro ?? "Falha ao exportar.");
        return;
      }
      const blob = new Blob([r.json], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conta-${nome.replace(/[^\w-]+/g, "-").toLowerCase() || tenantId}-lgpd.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <h2 className="font-corpo text-lg font-bold text-texto">Exportar dados da conta (LGPD)</h2>
      <p className="mt-1 text-sm text-texto-suave">
        Baixa um JSON com todos os dados desta conta (leads, conversas, agendamentos, eventos,
        configuração…). <strong>Sem senhas nem tokens</strong>. Útil para portabilidade ou como
        backup antes de excluir.
      </p>
      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}
      <button
        onClick={baixar}
        disabled={carregando}
        className="mt-4 flex items-center gap-2 rounded-sm border border-borda px-4 py-2.5 text-sm font-semibold text-texto transition-colors hover:bg-fundo disabled:opacity-50"
      >
        {carregando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {carregando ? "Gerando…" : "Exportar conta (JSON)"}
      </button>
    </div>
  );
}
