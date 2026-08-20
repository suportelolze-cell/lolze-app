"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, Loader2, MessageSquare, Mail, RefreshCw, Sparkles } from "lucide-react";
import { exportarLeadsCsv, reativarClienteIA } from "@/lib/supabase/crm-actions";
import type { Contato } from "@/lib/contatos/data";
import { PageHeader, Button, Badge, buttonClasses } from "@/components/ui";

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

// Situação: "cliente" = comprou de fato (app_vendas) OU fechou no funil (ganho);
// "perdido" = perdido; "lead" = todo o resto.
type Situacao = "cliente" | "lead" | "perdido";
function situacaoDe(c: { compras: number; coluna: string }): Situacao {
  if (c.compras > 0 || c.coluna === "ganho") return "cliente";
  if (c.coluna === "perdido") return "perdido";
  return "lead";
}
const SITUACAO_FILTROS: { valor: "todas" | Situacao; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "cliente", label: "Clientes" },
  { valor: "lead", label: "Leads" },
  { valor: "perdido", label: "Perdidos" },
];

// Último contato, a partir do updated_at.
const DIA = 86400000;
type Frieza = "recente" | "esfriando" | "sumido";
function diasDesde(iso: string): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
}
function friezaDe(iso: string): Frieza {
  const d = diasDesde(iso);
  if (d >= 30) return "sumido";
  if (d >= 15) return "esfriando";
  return "recente";
}
const CONTATO_FILTROS: { valor: "todos" | Frieza; label: string }[] = [
  { valor: "todos", label: "Qualquer" },
  { valor: "recente", label: "Recente (até 15 dias)" },
  { valor: "esfriando", label: "Esfriando (15 a 30 dias)" },
  { valor: "sumido", label: "Sumido (30+ dias)" },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBr = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const soDigitos = (s: string) => s.replace(/\D/g, "");

export function Contatos({ contatos, canais }: { contatos: Contato[]; canais: string[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("todos");
  const [situacao, setSituacao] = useState<"todas" | Situacao>("todas");
  const [contato, setContato] = useState<"todos" | Frieza>("todos");
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);
  const [reativando, setReativando] = useState<number | null>(null);
  const [feito, setFeito] = useState<Set<number>>(new Set());

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      const porCanal = filtro === "todos" || c.canal === filtro;
      const porSituacao = situacao === "todas" || situacaoDe(c) === situacao;
      const porContato = contato === "todos" || friezaDe(c.ultimoContato) === contato;
      const porBusca =
        !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q) || c.email.toLowerCase().includes(q);
      return porCanal && porSituacao && porContato && porBusca;
    });
  }, [contatos, filtro, situacao, contato, busca]);

  const resumoClientes = useMemo(() => {
    const clientes = contatos.filter((c) => c.compras > 0);
    const totalCents = clientes.reduce((s, c) => s + c.totalCompradoCents, 0);
    return { qtd: clientes.length, totalCents };
  }, [contatos]);

  async function reativar(id: number) {
    setReativando(id);
    const r = await reativarClienteIA(id);
    setReativando(null);
    if (r.ok) {
      setFeito((s) => new Set(s).add(id));
      router.refresh();
    } else {
      window.alert(r.erro ?? "Não foi possível reativar agora.");
    }
  }

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
  const selectCls =
    "rounded-md border border-borda bg-fundo px-2.5 py-1.5 text-xs font-medium text-texto outline-none focus:border-marca";

  return (
    <div className="flex flex-col">
      <PageHeader
        titulo="Contatos"
        descricao="Todos os seus contatos e clientes, de todos os canais, num lugar só. Filtre por situação e por quem faz tempo que não fala com você."
        acao={
          <Button variant="primary" onClick={exportar} disabled={exportando || lista.length === 0}>
            {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar planilha
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Resumo de clientes (só quando já há compras registradas) */}
        {resumoClientes.qtd > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-borda bg-superficie px-3 py-1.5">
              <b className="text-texto">{resumoClientes.qtd}</b>{" "}
              <span className="text-texto-suave">
                {resumoClientes.qtd === 1 ? "cliente que comprou" : "clientes que compraram"}
              </span>
            </span>
            <span className="rounded-md border border-borda bg-superficie px-3 py-1.5">
              <b className="text-marca">{brl(resumoClientes.totalCents / 100)}</b>{" "}
              <span className="text-texto-suave">em compras</span>
            </span>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col gap-3">
          {/* Canal + busca */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => setFiltro(c)}
                  className={`rounded-pill px-3 py-2 text-xs font-semibold transition-colors ${
                    filtro === c
                      ? "bg-marca text-bege-principal"
                      : "border border-borda bg-superficie text-texto-suave hover:border-marca hover:text-marca"
                  }`}
                >
                  {c === "todos" ? "Todos os canais" : rotuloCanal(c)}
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

          {/* Situação + último contato */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs text-texto-suave">
              Situação
              <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} className={selectCls}>
                {SITUACAO_FILTROS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-texto-suave">
              Último contato
              <select value={contato} onChange={(e) => setContato(e.target.value as typeof contato)} className={selectCls}>
                {CONTATO_FILTROS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie shadow-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-borda bg-fundo-2 text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Canal</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 font-semibold">Temp.</th>
                <th className="px-4 py-3 text-right font-semibold">Comprado</th>
                <th className="px-4 py-3 font-semibold">Último contato</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-texto-suave">
                    Nenhum contato encontrado com esses filtros.
                  </td>
                </tr>
              ) : (
                lista.map((c) => {
                  const f = friezaDe(c.ultimoContato);
                  return (
                    <tr key={c.id} className="hover:bg-fundo-2">
                      <td className="px-4 py-3 font-medium text-texto">
                        <span className="inline-flex items-center gap-2">
                          {c.nome || "—"}
                          {c.compras > 0 && <Badge tom="menta">Cliente</Badge>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-texto-suave">{c.telefone || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tom="menta">{rotuloCanal(c.canal)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-texto-suave">{COLUNA_LABEL[c.coluna] ?? c.coluna ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            TEMP_COR[c.temperatura] ?? TEMP_COR.frio
                          }`}
                        >
                          {c.temperatura || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-texto">
                        {c.compras > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {brl(c.totalCompradoCents / 100)}
                            {c.compras > 1 && (
                              <span className="text-[10px] font-medium text-texto-suave">{c.compras}×</span>
                            )}
                          </span>
                        ) : c.valor ? (
                          <span className="text-texto-suave">{brl(c.valor)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-texto-suave">
                        <span className="inline-flex items-center gap-2">
                          {dataBr(c.ultimoContato)}
                          {f === "esfriando" && <Badge tom="atencao">esfriando</Badge>}
                          {f === "sumido" && <Badge tom="erro">sumido</Badge>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.telefone && (
                            <a
                              href={`https://wa.me/${soDigitos(c.telefone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonClasses("secondary", "sm", "px-2.5")}
                              aria-label={`WhatsApp de ${c.nome || "contato"}`}
                            >
                              <MessageSquare size={14} />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className={buttonClasses("secondary", "sm", "px-2.5")}
                              aria-label={`E-mail de ${c.nome || "contato"}`}
                            >
                              <Mail size={14} />
                            </a>
                          )}
                          <Button
                            variant="verde"
                            size="sm"
                            className="px-2.5"
                            onClick={() => reativar(c.id)}
                            disabled={reativando === c.id || feito.has(c.id)}
                            aria-label={`Reativar ${c.nome || "contato"} com a IA`}
                            title="Reativar com a IA"
                          >
                            {reativando === c.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : feito.has(c.id) ? (
                              <Sparkles size={14} />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
