import Link from "next/link";
import {
  Plus,
  Users,
  Building2,
  Wallet,
  Eye,
  Settings2,
  Workflow,
  ScrollText,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { listarClientes, getPlanos } from "@/lib/admin/data";
import { entrarComo } from "@/lib/admin/actions";
import { temServiceKey } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const STATUS: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-marca-suave text-marca" },
  trial: { label: "Trial", cls: "bg-amber-100 text-amber-700" },
  suspenso: { label: "Suspenso", cls: "bg-amber-100 text-amber-700" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-600" },
};

export default async function AdminPage() {
  const [clientes, planos] = await Promise.all([listarClientes(), getPlanos()]);
  const semKey = !temServiceKey();

  const planoMap = new Map(planos.map((p) => [p.id, p]));
  const ativos = clientes.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((s, c) => s + (planoMap.get(c.plano)?.mensalCents ?? 0), 0);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Painel do <span className="text-marca">Administrador</span>
          </h1>
          <p className="mt-1 text-texto-suave">
            Controle total dos clientes, planos e acessos da Lolze.
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="flex items-center gap-2 rounded-sm bg-marca px-5 py-2.5 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
        >
          <Plus size={18} /> Cadastrar cliente
        </Link>
      </header>

      {semKey && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Para <strong>cadastrar clientes</strong>, configure a chave{" "}
            <code className="rounded bg-amber-100 px-1">SUPABASE_CRM_SERVICE_KEY</code> no{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> (Settings → API →
            service_role do projeto CRM). O resto do painel já funciona.
          </p>
        </div>
      )}

      {/* Resumo */}
      <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Resumo icon={Building2} titulo="Clientes" valor={String(clientes.length)} />
        <Resumo icon={Users} titulo="Ativos" valor={String(ativos.length)} />
        <Resumo icon={Wallet} titulo="Receita recorrente (MRR)" valor={brl(mrr)} />
      </section>

      {/* Ferramentas do admin */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Link
          href="/admin/planos"
          className="flex flex-col justify-between rounded-lg border border-borda bg-superficie px-5 py-4 transition-colors hover:border-marca"
        >
          <Settings2 size={18} className="text-marca" />
          <div>
            <p className="mt-2 text-sm font-semibold text-texto">Gerenciar planos</p>
            <p className="text-xs text-texto-suave">{planos.length} planos configurados</p>
          </div>
        </Link>
        <Link
          href="/admin/funil"
          className="flex flex-col justify-between rounded-lg border border-borda bg-superficie px-5 py-4 transition-colors hover:border-marca"
        >
          <Workflow size={18} className="text-marca" />
          <div>
            <p className="mt-2 text-sm font-semibold text-texto">Funil da Lolze</p>
            <p className="text-xs text-texto-suave">Aquisição: diagnóstico → ativação</p>
          </div>
        </Link>
        <Link
          href="/admin/auditoria"
          className="flex flex-col justify-between rounded-lg border border-borda bg-superficie px-5 py-4 transition-colors hover:border-marca"
        >
          <ScrollText size={18} className="text-marca" />
          <div>
            <p className="mt-2 text-sm font-semibold text-texto">Auditoria</p>
            <p className="text-xs text-texto-suave">Quem alterou o agente e a config</p>
          </div>
        </Link>
      </section>

      {/* Tabela de clientes */}
      <section className="overflow-hidden rounded-lg border border-borda bg-superficie">
        <div className="border-b border-borda px-5 py-3">
          <h2 className="font-semibold text-texto">Clientes</h2>
        </div>

        {clientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-texto-suave">
            Nenhum cliente ainda. Clique em “Cadastrar cliente” para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="px-5 py-3 font-medium">Negócio</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Leads</th>
                  <th className="px-5 py-3 font-medium">Usuários</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const st = STATUS[c.status] ?? STATUS.ativo;
                  const plano = planoMap.get(c.plano);
                  return (
                    <tr key={c.id} className="border-b border-borda last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-texto">{c.nome}</p>
                        <p className="text-xs text-texto-suave">{c.contatoEmail}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-texto">{plano?.nome ?? c.plano}</span>
                        {plano && (
                          <span className="block text-xs text-texto-suave">
                            {brl(plano.mensalCents)}/mês
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-texto">{c.leads}</td>
                      <td className="px-5 py-3 text-texto">{c.usuarios}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <form action={entrarComo.bind(null, c.id)}>
                            <button
                              type="submit"
                              className="flex items-center gap-1.5 rounded-sm border border-borda px-3 py-1.5 text-xs font-semibold text-texto transition-colors hover:border-marca hover:text-marca"
                            >
                              <Eye size={14} /> Entrar como
                            </button>
                          </form>
                          <Link
                            href={`/admin/clientes/${c.id}`}
                            className="rounded-sm bg-escuro-quente px-3 py-1.5 text-xs font-semibold text-bege-principal transition-transform hover:scale-[1.03]"
                          >
                            Gerenciar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Resumo({
  icon: Icon,
  titulo,
  valor,
}: {
  icon: LucideIcon;
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-lg border border-borda bg-superficie px-5 py-4">
      <Icon size={18} className="text-marca" />
      <p className="mt-2 text-2xl font-semibold text-texto">{valor}</p>
      <p className="text-xs text-texto-suave">{titulo}</p>
    </div>
  );
}
