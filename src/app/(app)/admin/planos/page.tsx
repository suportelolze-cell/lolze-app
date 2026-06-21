import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { getPlanos } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export default async function PlanosPage() {
  const planos = await getPlanos();

  return (
    <>
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
      >
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>

      <header className="mb-8">
        <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
          Planos <span className="text-marca">Lolze</span>
        </h1>
        <p className="mt-1 text-texto-suave">
          Tabela oficial de precificação aplicada aos clientes.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {planos.map((p) => (
          <div key={p.id} className="flex flex-col rounded-xl border border-borda bg-superficie p-6">
            <h2 className="font-corpo text-lg font-bold text-texto">{p.nome}</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-texto-suave">
              {p.canaisMax} {p.canaisMax > 1 ? "canais" : "canal"}
            </p>

            <div className="mt-4 border-y border-borda py-4">
              <p className="text-3xl font-semibold text-texto">
                {brl(p.mensalCents)}
                <span className="text-sm font-normal text-texto-suave">/mês</span>
              </p>
              <p className="mt-1 text-sm text-texto-suave">
                Implementação: <strong className="text-texto">{brl(p.setupCents)}</strong>
              </p>
              <p className="text-xs text-marca">
                {p.carenciaDias} dias de carência (1º mês sem mensalidade)
              </p>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-texto">
              {p.recursos.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-marca" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-texto-suave">
        Para alterar nomes, preços ou recursos, edite a tabela{" "}
        <code className="rounded bg-fundo px-1">app_plans</code> no Supabase. Em breve dá para
        editar por aqui.
      </p>
    </>
  );
}
