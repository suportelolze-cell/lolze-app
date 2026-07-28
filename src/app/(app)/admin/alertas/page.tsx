import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAlertas } from "@/lib/admin/alertas-data";

export const dynamic = "force-dynamic";

export default async function AdminAlertasPage() {
  const r = await getAlertas();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
      >
        <ArrowLeft size={15} /> Voltar ao painel
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-medium italic tracking-tight text-texto">
          <ShieldAlert size={22} className="text-marca" /> Central de alertas
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          Estado de todos os clientes agora — não espera erro aparecer. IA sem canal, mensagens não
          entregues, custo perto do teto, erros e IA desligada.
        </p>
      </header>

      {/* Contadores */}
      <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Contador rotulo="Críticos" valor={r.criticos} tom={r.criticos > 0 ? "critico" : "ok"} />
        <Contador rotulo="Atenção" valor={r.atencao} tom={r.atencao > 0 ? "atencao" : "ok"} />
        <Contador rotulo="Clientes afetados" valor={r.tenantsComAlerta} tom="neutro" />
      </section>

      {r.alertas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borda bg-superficie p-10 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-marca" />
          <p className="text-sm text-texto-suave">Tudo certo — nenhum cliente com alerta no momento.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {r.alertas.map((a, i) => {
            const critico = a.severidade === "critico";
            return (
              <li
                key={`${a.tenantId}-${a.tipo}-${i}`}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  critico ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <AlertTriangle
                  size={16}
                  className={`mt-0.5 shrink-0 ${critico ? "text-red-600" : "text-amber-600"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-texto">
                    <Link href={`/admin/clientes/${a.tenantId}`} className="hover:underline">
                      {a.nome}
                    </Link>
                  </p>
                  <p className={`text-sm ${critico ? "text-red-700" : "text-amber-800"}`}>{a.mensagem}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Contador({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: number;
  tom: "critico" | "atencao" | "ok" | "neutro";
}) {
  const cor =
    tom === "critico"
      ? "border-red-200 bg-red-50 text-red-700"
      : tom === "atencao"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tom === "ok"
          ? "border-borda bg-superficie text-marca"
          : "border-borda bg-superficie text-texto";
  return (
    <div className={`rounded-xl border p-3 text-center sm:p-4 ${cor}`}>
      <p className="text-2xl font-bold">{valor}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-80">{rotulo}</p>
    </div>
  );
}
