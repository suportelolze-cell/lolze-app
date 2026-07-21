import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  BadgeDollarSign,
  Timer,
  Trophy,
  Inbox,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { getResultados } from "@/lib/resultados";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PERIODOS = [
  { d: 7, label: "7 dias" },
  { d: 30, label: "30 dias" },
  { d: 90, label: "90 dias" },
];

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sessao = await getSessao();
  if (sessao.papel === "superadmin" && !sessao.impersonating) redirect("/admin");

  const sp = await searchParams;
  const dias = Number(sp?.d) === 7 || Number(sp?.d) === 90 ? Number(sp.d) : 30;
  const r = await getResultados(dias);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-texto-suave">
            <TrendingUp size={16} className="text-marca" /> Resultados
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium italic tracking-tight text-texto">
            O que a operação entregou
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave">
            <ShieldCheck size={14} className="text-marca" />
            Cada número é um evento real registrado — nada estimado.
          </p>
        </div>

        {/* Seletor de período (links, sem JS) */}
        <div className="flex rounded-lg border border-borda bg-superficie p-0.5">
          {PERIODOS.map((p) => (
            <Link
              key={p.d}
              href={`/resultados?d=${p.d}`}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                r.dias === p.d ? "bg-marca text-bege-principal" : "text-texto-suave hover:text-texto"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </header>

      {!r.temDados ? (
        <div className="rounded-xl border border-dashed border-borda bg-superficie p-10 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-texto-suave" />
          <h2 className="font-corpo text-lg font-bold text-texto">Ainda sem eventos neste período</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-texto-suave">
            Esta tela se preenche sozinha conforme a operação roda: cada lead recebido,
            resposta da IA, agendamento, comparecimento e venda vira um fato datado aqui.
            Assim que os primeiros leads chegarem, os resultados aparecem — sem você
            precisar lançar nada à mão.
          </p>
          <Link
            href="/hoje"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-marca px-4 py-2 text-sm font-semibold text-bege-principal"
          >
            Ver o que fazer hoje →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cartões de topo */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Cartao
              icone={BadgeDollarSign}
              titulo="Receita confirmada"
              valor={brl(r.receitaConfirmada)}
              rodape={`${r.vendas} ${r.vendas === 1 ? "venda" : "vendas"} no período`}
              destaque
            />
            <Cartao
              icone={Trophy}
              titulo="Ticket médio"
              valor={r.ticketMedio > 0 ? brl(r.ticketMedio) : "—"}
              rodape={r.ticketMedio > 0 ? "Por venda confirmada" : "Sem venda com valor ainda"}
            />
            <Cartao
              icone={Timer}
              titulo="1ª resposta (mediana)"
              valor={r.slaMedianaMin != null ? `${r.slaMedianaMin} min` : "—"}
              rodape={
                r.pctRespondidoAte5min != null
                  ? `${r.pctRespondidoAte5min}% em até 5 min · ${r.leadsComResposta} leads`
                  : "Sem par recebido/respondido ainda"
              }
            />
          </section>

          {/* Funil por eventos */}
          <section className="rounded-xl border border-borda bg-superficie p-6">
            <h2 className="mb-1 flex items-center gap-2 font-corpo text-lg font-bold text-texto">
              <Zap size={18} className="text-marca" /> Funil de conversão
            </h2>
            <p className="mb-5 text-sm text-texto-suave">
              Quantos leads distintos chegaram a cada etapa — e quanto converteu da etapa anterior.
            </p>
            <div className="space-y-2.5">
              {r.etapas.map((e) => {
                const largura = e.pctDaBase != null ? Math.max(e.pctDaBase, e.total > 0 ? 4 : 0) : 0;
                return (
                  <div key={e.chave} className="flex items-center gap-4">
                    <div className="w-40 shrink-0">
                      <p className="text-sm font-semibold text-texto">{e.label}</p>
                      <p className="text-[11px] text-texto-suave">{e.descricao}</p>
                    </div>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-fundo">
                      <div
                        className="flex h-full items-center rounded-md bg-marca/85 px-3 transition-all"
                        style={{ width: `${largura}%` }}
                      >
                        <span className="text-sm font-bold text-bege-principal">{e.total}</span>
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      {e.pctDoAnterior != null ? (
                        <span className="text-xs font-semibold text-texto-suave">
                          {e.pctDoAnterior}%<span className="text-[10px] font-normal"> da etapa</span>
                        </span>
                      ) : e.pctDaBase != null ? (
                        <span className="text-xs font-semibold text-marca">base</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Atribuição de receita por canal */}
          <section className="rounded-xl border border-borda bg-superficie p-6">
            <h2 className="mb-1 flex items-center gap-2 font-corpo text-lg font-bold text-texto">
              <BadgeDollarSign size={18} className="text-marca" /> Receita por canal
            </h2>
            <p className="mb-5 text-sm text-texto-suave">
              De onde veio o dinheiro fechado — atribuído ao canal de origem do lead.
            </p>
            {r.canais.length === 0 ? (
              <p className="text-sm text-texto-suave">
                Nenhuma receita confirmada com valor neste período. Ao marcar um lead como
                ganho, informe o valor fechado para ele aparecer aqui.
              </p>
            ) : (
              <ul className="space-y-2">
                {r.canais.map((c) => {
                  const pct = r.receitaConfirmada > 0 ? (c.receita / r.receitaConfirmada) * 100 : 0;
                  return (
                    <li key={c.canal} className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-sm font-semibold text-texto">{c.canal}</span>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-fundo">
                        <div
                          className="h-full rounded-md bg-marca/70"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                      <span className="w-32 shrink-0 text-right text-sm font-bold text-texto">
                        {brl(c.receita)}
                        <span className="ml-1 text-[11px] font-normal text-texto-suave">
                          · {c.vendas} {c.vendas === 1 ? "venda" : "vendas"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-center text-[11px] text-texto-suave">
            {r.totalEventos} eventos registrados nos últimos {r.dias} dias · fonte: ledger app_eventos
          </p>
        </div>
      )}
    </>
  );
}

function Cartao({
  icone: Icone,
  titulo,
  valor,
  rodape,
  destaque = false,
}: {
  icone: typeof TrendingUp;
  titulo: string;
  valor: string;
  rodape: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        destaque ? "border-marca/30 bg-marca-suave/40" : "border-borda bg-superficie"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-texto-suave">
        <Icone size={14} className="text-marca" /> {titulo}
      </p>
      <p className="mt-2 text-2xl font-bold text-texto">{valor}</p>
      <p className="mt-1 text-xs text-texto-suave">{rodape}</p>
    </div>
  );
}
