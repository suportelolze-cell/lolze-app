"use client";

import { useMemo, useState } from "react";
import { Search, Download, Loader2 } from "lucide-react";
import { exportarLeadsCsv } from "@/lib/supabase/crm-actions";
import type { Contato } from "@/lib/contatos/data";
import { ORIGEM_LABEL } from "@/lib/leads";
import { PageHeader, Button, Badge } from "@/components/ui";

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  manual: "Manual",
  site: "Site",
  trafego_pago: "Tráfego pago",
};
const rotuloCanal = (c: string) =>
  CANAL_LABEL[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : "—");

const COLUNA_LABEL: Record<string, string> = {
  entrada: "Entrada",
  qualificacao: "Em qualificação",
  atencao: "Atenção humana",
  agendado: "Agendado",
  ganho: "Ganho",
  perdido: "Perdido",
};

const TEMP_COR: Record<string, string> = {
  quente: "bg-orange-100 text-orange-700",
  morno: "bg-amber-100 text-amber-700",
  frio: "bg-fundo-2 text-texto-suave",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBr = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export function Contatos({ contatos, canais }: { contatos: Contato[]; canais: string[] }) {
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      const porCanal = filtro === "todos" || c.canal === filtro;
      const porBusca =
        !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q) || c.email.toLowerCase().includes(q);
      return porCanal && porBusca;
    });
  }, [contatos, filtro, busca]);

  async function exportar() {
    setExportando(true);
    try {
      const csv = await exportarLeadsCsv(filtro === "todos" ? undefined : filtro);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contatos-lolze-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  const chips = ["todos", ...canais];

  return (
    <div className="flex flex-col">
      <PageHeader
        titulo="Contatos"
        descricao="Todos os seus contatos, de todos os canais, num lugar só."
        acao={
          <Button variant="primary" onClick={exportar} disabled={exportando || lista.length === 0}>
            {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar planilha
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
      {/* Filtros por canal + busca */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setFiltro(c)}
              className={`rounded-pill px-3 py-2 text-xs font-semibold transition-colors ${
                filtro === c ? "bg-marca text-bege-principal" : "border border-borda bg-superficie text-texto-suave hover:border-marca hover:text-marca"
              }`}
            >
              {c === "todos" ? "Todos" : rotuloCanal(c)}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail…"
            className="w-full rounded-md border border-borda bg-fundo py-2 pl-9 pr-3 text-sm text-texto outline-none focus:border-marca"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-borda bg-superficie shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-borda bg-fundo-2 text-xs uppercase tracking-wide text-texto-suave">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Telefone</th>
              <th className="px-4 py-3 font-semibold">Canal</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Etapa</th>
              <th className="px-4 py-3 font-semibold">Temp.</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Entrou</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {lista.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-texto-suave">
                  Nenhum contato encontrado.
                </td>
              </tr>
            ) : (
              lista.map((c) => (
                <tr key={c.id} className="hover:bg-fundo-2">
                  <td className="px-4 py-3 font-medium text-texto">{c.nome || "—"}</td>
                  <td className="px-4 py-3 text-texto-suave">{c.telefone || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tom="menta">{rotuloCanal(c.canal)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-texto-suave">
                    {c.origem ? (ORIGEM_LABEL[c.origem] ?? c.origem) : "—"}
                  </td>
                  <td className="px-4 py-3 text-texto-suave">{COLUNA_LABEL[c.coluna] ?? c.coluna ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold capitalize ${TEMP_COR[c.temperatura] ?? TEMP_COR.frio}`}>
                      {c.temperatura || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-texto">{c.valor ? brl(c.valor) : "—"}</td>
                  <td className="px-4 py-3 text-texto-suave">{dataBr(c.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-texto-suave">
        Mostrando {lista.length} de {contatos.length} contatos. A exportação respeita o filtro de canal selecionado.
      </p>
      </div>
    </div>
  );
}
