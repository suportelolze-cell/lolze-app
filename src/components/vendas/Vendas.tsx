"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { VendasDados } from "@/lib/vendas/data";
import { PageHeader, Acento, Badge, type BadgeTom } from "@/components/ui";

const EVENTO_META: Record<string, { label: string; tom: BadgeTom }> = {
  compra_aprovada: { label: "Aprovada", tom: "menta" },
  pix_gerado: { label: "PIX pendente", tom: "atencao" },
  boleto_gerado: { label: "Boleto pendente", tom: "atencao" },
  checkout_abandonado: { label: "Carrinho abandonado", tom: "neutro" },
  reembolso: { label: "Reembolso", tom: "erro" },
  chargeback: { label: "Chargeback", tom: "erro" },
  assinatura_cancelada: { label: "Assinatura cancelada", tom: "erro" },
  outro: { label: "Outro", tom: "neutro" },
};
const metaEvento = (e: string) => EVENTO_META[e] ?? { label: e || "—", tom: "neutro" as BadgeTom };

const PLATAFORMA_LABEL: Record<string, string> = { hotmart: "Hotmart", ticto: "Ticto", kiwify: "Kiwify" };
const rotuloPlat = (p: string) => PLATAFORMA_LABEL[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : "—");

type Filtro = "todas" | "aprovadas" | "pendentes" | "abandonados" | "reembolsos";
const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "aprovadas", label: "Aprovadas" },
  { valor: "pendentes", label: "Pendentes" },
  { valor: "abandonados", label: "Abandonados" },
  { valor: "reembolsos", label: "Reembolsos" },
];
const casaFiltro = (evento: string, f: Filtro): boolean => {
  if (f === "todas") return true;
  if (f === "aprovadas") return evento === "compra_aprovada";
  if (f === "pendentes") return evento === "pix_gerado" || evento === "boleto_gerado";
  if (f === "abandonados") return evento === "checkout_abandonado";
  if (f === "reembolsos") return evento === "reembolso" || evento === "chargeback";
  return true;
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBr = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export function Vendas({ dados }: { dados: VendasDados }) {
  const { vendas, resumo, migracaoPendente } = dados;
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vendas.filter((v) => {
      const porTipo = casaFiltro(v.evento, filtro);
      const porBusca =
        !q || v.comprador.toLowerCase().includes(q) || v.produto.toLowerCase().includes(q);
      return porTipo && porBusca;
    });
  }, [vendas, filtro, busca]);

  const cards: { label: string; valor: string; forte?: boolean }[] = [
    { label: "Faturado (aprovado)", valor: brl(resumo.faturadoCents), forte: true },
    { label: "Vendas aprovadas", valor: String(resumo.aprovadas) },
    { label: "Pagamentos pendentes", valor: String(resumo.pendentes) },
    { label: "Reembolsos", valor: String(resumo.reembolsos) },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        titulo={<>Suas <Acento>Vendas</Acento></>}
        descricao="Cada compra, PIX, boleto, carrinho abandonado e reembolso das suas plataformas de checkout, num lugar só."
      />

      <div className="flex flex-col gap-5">
        {migracaoPendente && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Conecte uma plataforma de checkout em Configurações → Vendas e Checkout para começar a ver suas vendas aqui.
          </p>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border border-borda bg-superficie px-5 py-4 shadow-card">
              <p className={`text-2xl font-semibold ${c.forte ? "text-marca" : "text-texto"}`}>{c.valor}</p>
              <p className="mt-1 text-xs text-texto-suave">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`rounded-pill px-3 py-2 text-xs font-semibold transition-colors ${
                  filtro === f.valor
                    ? "bg-marca text-bege-principal"
                    : "border border-borda bg-superficie text-texto-suave hover:border-marca hover:text-marca"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por comprador ou produto…"
              className="w-full rounded-md border border-borda bg-fundo py-2 pl-9 pr-3 text-sm text-texto outline-none focus:border-marca"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie shadow-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-borda bg-fundo-2 text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Quando</th>
                <th className="px-4 py-3 font-semibold">Comprador</th>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 text-right font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3 font-semibold">Plataforma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-texto-suave">
                    {migracaoPendente
                      ? "Nenhuma venda ainda. Ative o checkout para começar."
                      : "Nenhuma venda encontrada com esses filtros."}
                  </td>
                </tr>
              ) : (
                lista.map((v) => {
                  const m = metaEvento(v.evento);
                  return (
                    <tr key={v.id} className="hover:bg-fundo-2">
                      <td className="px-4 py-3 text-texto-suave">{dataBr(v.criadoEm)}</td>
                      <td className="px-4 py-3 font-medium text-texto">{v.comprador || "—"}</td>
                      <td className="px-4 py-3 text-texto-suave">{v.produto || v.oferta || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-texto">
                        {v.valorCents ? brl(v.valorCents) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tom={m.tom}>{m.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-texto-suave">{rotuloPlat(v.plataforma)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-texto-suave">
          Mostrando {lista.length} de {vendas.length} vendas.
        </p>
      </div>
    </div>
  );
}
