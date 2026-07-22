import Link from "next/link";
import { ArrowLeft, Coins, AlertTriangle, Inbox } from "lucide-react";
import { getCustos } from "@/lib/admin/custos-data";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brl2 = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const META_MARGEM = 70; // dossiê §12: margem bruta acima de 70% antes de escalar

export default async function AdminCustosPage() {
  const r = await getCustos();
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto">
        <ArrowLeft size={15} /> Voltar ao painel
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-medium italic tracking-tight text-texto">
          <Coins size={22} className="text-marca" /> Custo &amp; margem por cliente
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          Custo real de IA vs. mensalidade, em {mes}. Base para decidir preço e franquia (dossiê §12).
        </p>
      </header>

      {/* Totais */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card titulo="Receita recorrente (MRR)" valor={brl(r.totalReceitaCents)} rodape="Soma das mensalidades" />
        <Card titulo="Custo de IA no mês" valor={brl2(r.totalCustoCents)} rodape="Todos os tenants somados" />
        <Card
          titulo="Margem bruta (IA)"
          valor={r.margemGlobalPct != null ? `${r.margemGlobalPct}%` : "—"}
          rodape={`Meta do dossiê: > ${META_MARGEM}%`}
          alerta={r.margemGlobalPct != null && r.margemGlobalPct < META_MARGEM}
          destaque
        />
      </section>

      {r.tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borda bg-superficie p-10 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-texto-suave" />
          <p className="text-sm text-texto-suave">Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-borda bg-superficie">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-right">Mensalidade</th>
                  <th className="px-4 py-3 font-medium text-right">Custo IA (mês)</th>
                  <th className="px-4 py-3 font-medium text-right">Margem</th>
                  <th className="px-4 py-3 font-medium text-right">Chamadas</th>
                </tr>
              </thead>
              <tbody>
                {r.tenants.map((t) => {
                  const baixa = t.margemPct != null && t.margemPct < META_MARGEM;
                  return (
                    <tr key={t.tenantId} className="border-b border-borda last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-texto">{t.nome}</p>
                        <p className="text-xs text-texto-suave">
                          {t.plano}
                          {t.status !== "ativo" && <span className="ml-1">· {t.status}</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-texto">{brl(t.receitaCents)}</td>
                      <td className="px-4 py-3 text-right text-texto">{brl2(t.custoCents)}</td>
                      <td className="px-4 py-3 text-right">
                        {t.margemPct == null ? (
                          <span className="text-texto-suave">—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 font-semibold ${baixa ? "text-red-600" : "text-marca"}`}>
                            {baixa && <AlertTriangle size={12} />}
                            {t.margemPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-texto-suave">{t.chamadas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-texto-suave">
        Custo estimado à tarifa do modelo do SDR (Sonnet) — <strong>conservador</strong>: o roteador e o
        demo usam Haiku (mais barato), então o custo real tende a ser menor. Não inclui suporte, infra
        nem custo de canais. Taxa USD→BRL configurável em <code>USD_BRL</code>.
      </p>
    </div>
  );
}

function Card({
  titulo,
  valor,
  rodape,
  destaque = false,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  rodape: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        alerta ? "border-red-200 bg-red-50" : destaque ? "border-marca/30 bg-marca-suave/40" : "border-borda bg-superficie"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-texto-suave">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${alerta ? "text-red-700" : "text-texto"}`}>{valor}</p>
      <p className="mt-1 text-xs text-texto-suave">{rodape}</p>
    </div>
  );
}
