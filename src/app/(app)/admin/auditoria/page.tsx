import Link from "next/link";
import { ArrowLeft, ScrollText, Inbox } from "lucide-react";
import { listarAuditoria } from "@/lib/admin/auditoria";

export const dynamic = "force-dynamic";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Cor do selo por família de ação (segurança/destrutivo em destaque).
function tomAcao(acao: string): string {
  if (acao === "cliente.excluido") return "bg-red-100 text-red-700";
  if (acao === "impersonacao.iniciada") return "bg-amber-100 text-amber-700";
  if (acao === "ia.pausada") return "bg-amber-100 text-amber-700";
  return "bg-marca-suave text-marca";
}

export default async function AdminAuditoriaPage() {
  const linhas = await listarAuditoria(150);

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
          <ScrollText size={22} className="text-marca" /> Auditoria
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          Trilha de quem alterou o quê no agente e nas configurações — persona, IA ligada/desligada,
          planos, acessos e impersonações. Append-only.
        </p>
      </header>

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borda bg-superficie p-10 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-texto-suave" />
          <p className="text-sm text-texto-suave">
            Nenhum evento registrado ainda. As próximas alterações no agente e na configuração
            aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-borda bg-superficie">
          {linhas.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 border-b border-borda px-5 py-3 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tomAcao(l.acao)}`}>
                  {l.acaoRotulo}
                </span>
                <span className="truncate text-sm text-texto">
                  {l.alvo ?? "—"}
                  {l.ator && <span className="text-texto-suave"> · por {l.ator}</span>}
                </span>
              </div>
              <span className="shrink-0 text-xs text-texto-suave">{quando(l.quando)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
