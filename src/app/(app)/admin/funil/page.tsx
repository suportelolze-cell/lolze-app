import Link from "next/link";
import { Workflow, Inbox, ArrowLeft, Sparkles, ShoppingCart } from "lucide-react";
import { getFunilLolze, getFunilLolzeRecentes } from "@/lib/admin/funil-lolze-data";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { d: "7", label: "7 dias" },
  { d: "30", label: "30 dias" },
  { d: "90", label: "90 dias" },
  { d: "tudo", label: "Tudo" },
];

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminFunilPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  const dias = sp?.d === "7" ? 7 : sp?.d === "90" ? 90 : sp?.d === "tudo" ? null : 30;
  const ativo = sp?.d === "7" ? "7" : sp?.d === "90" ? "90" : sp?.d === "tudo" ? "tudo" : "30";

  const [r, recentes] = await Promise.all([getFunilLolze(dias), getFunilLolzeRecentes(20)]);

  return (
    <>
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
        >
          <ArrowLeft size={15} /> Voltar ao painel
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-medium italic tracking-tight text-texto">
              <Workflow size={22} className="text-marca" /> Funil da Lolze
            </h1>
            <p className="mt-1 text-sm text-texto-suave">
              A jornada de aquisição da própria Lolze — do diagnóstico à ativação. Eventos
              reais registrados; nada estimado.
            </p>
          </div>
          <div className="flex rounded-lg border border-borda bg-superficie p-0.5">
            {PERIODOS.map((p) => (
              <Link
                key={p.d}
                href={`/admin/funil?d=${p.d}`}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  ativo === p.d ? "bg-marca text-bege-principal" : "text-texto-suave hover:text-texto"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {!r.temDados ? (
        <div className="rounded-xl border border-dashed border-borda bg-superficie p-10 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-texto-suave" />
          <h2 className="font-corpo text-lg font-bold text-texto">Ainda sem eventos neste período</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-texto-suave">
            O funil se preenche sozinho: cada uso da calculadora, mensagem no demo, aplicação,
            cadastro, checkout, pagamento e ativação vira um evento aqui. Assim que a landing
            começar a receber tráfego, os números aparecem.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Topo de funil — engajamento (não é pessoa-a-pessoa) */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-texto-suave">
              <Sparkles size={15} className="text-marca" /> Topo — interesse
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {r.topo.map((t) => (
                <div key={t.chave} className="rounded-xl border border-borda bg-superficie p-5">
                  <p className="text-2xl font-bold text-texto">{t.total.toLocaleString("pt-BR")}</p>
                  <p className="mt-1 text-sm font-semibold text-texto">{t.label}</p>
                  <p className="text-xs text-texto-suave">{t.descricao}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Jornada de compra — funil de conversão */}
          <section className="rounded-xl border border-borda bg-superficie p-6">
            <h2 className="mb-1 flex items-center gap-2 font-corpo text-lg font-bold text-texto">
              <ShoppingCart size={18} className="text-marca" /> Jornada de compra
            </h2>
            <p className="mb-5 text-sm text-texto-suave">
              Da aplicação até a ativação — conversão sobre a base (aplicações) e sobre a etapa anterior.
            </p>
            <div className="space-y-2.5">
              {r.jornada.map((e) => {
                const largura = e.pctBase != null ? Math.max(e.pctBase, e.total > 0 ? 4 : 0) : 0;
                return (
                  <div key={e.chave} className="flex items-center gap-4">
                    <div className="w-44 shrink-0 text-sm font-semibold text-texto">{e.label}</div>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-fundo">
                      <div
                        className="flex h-full items-center rounded-md bg-marca/85 px-3 transition-all"
                        style={{ width: `${largura}%` }}
                      >
                        <span className="text-sm font-bold text-bege-principal">{e.total}</span>
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      {e.pctAnterior != null ? (
                        <span className="text-xs font-semibold text-texto-suave">
                          {e.pctAnterior}%<span className="text-[10px] font-normal"> da etapa</span>
                        </span>
                      ) : e.pctBase != null ? (
                        <span className="text-xs font-semibold text-marca">base</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Eventos recentes */}
          {recentes.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-borda bg-superficie">
              <div className="border-b border-borda px-5 py-3">
                <h2 className="text-sm font-semibold text-texto">Últimos eventos</h2>
              </div>
              <ul className="divide-y divide-borda">
                {recentes.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="font-medium text-texto">
                      {ev.evento}
                      {ev.resumo && <span className="ml-2 text-xs text-texto-suave">· {ev.resumo}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-texto-suave">{dataHora(ev.quando)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-center text-[11px] text-texto-suave">
            {r.total.toLocaleString("pt-BR")} eventos no período · fonte: app_funil_lolze
          </p>
        </div>
      )}
    </>
  );
}
