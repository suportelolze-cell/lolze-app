"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, RefreshCw, AlertTriangle, Trophy, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { reativarClienteIA } from "@/lib/supabase/crm-actions";
import type { RecorrenciaDados, ClienteRecorrente } from "@/lib/supabase/crm-data";

function Card({ icon: Icon, titulo, valor, cor }: { icon: typeof Users; titulo: string; valor: string | number; cor: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie px-5 py-4">
      <Icon size={18} className={cor} />
      <p className="mt-2 text-2xl font-semibold text-texto">{valor}</p>
      <p className="text-xs text-texto-suave">{titulo}</p>
    </div>
  );
}

export function Recorrencia({ dados }: { dados: RecorrenciaDados }) {
  const router = useRouter();
  const [reativando, setReativando] = useState<number | null>(null);
  const [feito, setFeito] = useState<Set<number>>(new Set());

  const churn = dados.clientes.filter((c) => c.churn);

  async function reativar(c: ClienteRecorrente) {
    setReativando(c.leadId);
    const r = await reativarClienteIA(c.leadId);
    setReativando(null);
    if (r.ok) {
      setFeito((s) => new Set(s).add(c.leadId));
      router.refresh();
    } else {
      window.alert(r.erro ?? "Não foi possível reativar.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
          Recorrência — Carteira de Clientes
        </h1>
        <p className="mt-1 text-texto-suave">
          Só clientes que já fecharam serviço. Acompanhe frequência, risco de perda e seus melhores clientes.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card icon={Users} titulo="Clientes na base" valor={dados.totalBase} cor="text-marca" />
        <Card icon={RefreshCw} titulo="Serviços nos últimos 30 dias" valor={dados.servicosMes} cor="text-marca" />
        <Card icon={AlertTriangle} titulo="Em risco de churn" valor={dados.emChurn} cor="text-amber-600" />
      </section>

      {/* Alerta de Churn */}
      <section className="rounded-lg border border-borda bg-superficie p-6">
        <h2 className="flex items-center gap-2 font-corpo text-lg font-bold text-texto">
          <AlertTriangle size={18} className="text-amber-600" /> Alerta de Churn — reative agora
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Clientes recorrentes que passaram da cadência habitual. Mande a IA reativar com um toque.
        </p>
        {churn.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-borda px-4 py-6 text-center text-xs italic text-texto-suave">
            Ninguém em risco no momento. 🎉
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {churn.map((c) => (
              <div key={c.leadId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-texto">{c.nome}</p>
                  <p className="text-xs text-texto-suave">
                    Sumido há <b>{c.diasDesdeUltimo} dias</b>
                    {c.cadenciaDias ? ` · costumava voltar a cada ~${c.cadenciaDias} dias` : ""} · {c.totalServicos} serviços
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.telefone && (
                    <a
                      href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md border border-borda px-3 py-1.5 text-xs font-semibold text-texto hover:bg-fundo"
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => reativar(c)}
                    disabled={reativando === c.leadId || feito.has(c.leadId)}
                    className="flex items-center gap-1.5 rounded-md bg-marca px-3 py-1.5 text-xs font-bold text-bege-principal disabled:opacity-50"
                  >
                    {reativando === c.leadId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {feito.has(c.leadId) ? "Reativado" : "Reativar com IA"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Curva ABC / Top clientes */}
      <section className="rounded-lg border border-borda bg-superficie p-6">
        <h2 className="flex items-center gap-2 font-corpo text-lg font-bold text-texto">
          <Trophy size={18} className="text-marca" /> Top Clientes (Curva ABC)
        </h2>
        <p className="mt-1 text-sm text-texto-suave">Quem mais gera volume de serviços pra você.</p>
        {dados.clientes.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-borda px-4 py-6 text-center text-xs italic text-texto-suave">
            Nenhum cliente recorrente ainda. Assim que alguém fechar o 1º serviço, aparece aqui.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Cliente</th>
                  <th className="py-2 pr-2 text-center">Serviços</th>
                  <th className="py-2 pr-2 text-center">Últimos 30d</th>
                  <th className="py-2 pr-2 text-center">Cadência</th>
                  <th className="py-2 pr-2 text-center">Último</th>
                </tr>
              </thead>
              <tbody>
                {dados.clientes.map((c, i) => (
                  <tr key={c.leadId} className="border-b border-borda/60">
                    <td className="py-2 pr-2 font-semibold text-texto-suave">{i + 1}</td>
                    <td className="py-2 pr-2 font-semibold text-texto">
                      {c.nome}
                      {c.churn && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">risco</span>}
                    </td>
                    <td className="py-2 pr-2 text-center font-bold text-marca">{c.totalServicos}</td>
                    <td className="py-2 pr-2 text-center text-texto">{c.servicos30d}</td>
                    <td className="py-2 pr-2 text-center text-texto-suave">{c.cadenciaDias ? `~${c.cadenciaDias}d` : "—"}</td>
                    <td className="py-2 pr-2 text-center text-texto-suave">{c.diasDesdeUltimo === 0 ? "hoje" : `${c.diasDesdeUltimo}d atrás`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
