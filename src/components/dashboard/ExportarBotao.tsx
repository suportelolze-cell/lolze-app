"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { exportarLeadsCsv } from "@/lib/supabase/crm-actions";

/** Exporta os leads em CSV e oferece "Imprimir/PDF" (via diálogo do navegador). */
export function ExportarBotao() {
  const [carregando, setCarregando] = useState(false);

  async function baixarCsv() {
    setCarregando(true);
    try {
      const csv = await exportarLeadsCsv();
      // BOM (﻿) para o Excel abrir os acentos corretamente
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-lolze-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={baixarCsv}
        disabled={carregando}
        className="flex items-center gap-2 rounded-sm border border-borda px-4 py-2.5 text-sm font-semibold text-texto transition-colors hover:bg-superficie disabled:opacity-50"
      >
        <Download size={16} /> {carregando ? "Gerando…" : "Exportar CSV"}
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-sm border border-borda px-4 py-2.5 text-sm font-semibold text-texto transition-colors hover:bg-superficie"
        title="Imprimir ou salvar como PDF"
      >
        <Printer size={16} /> PDF
      </button>
    </div>
  );
}
