import {
  DollarSign,
  Users,
  Sparkles,
  CalendarCheck,
  Target,
  GraduationCap,
} from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TracaoChart } from "@/components/dashboard/TracaoChart";
import { PulsoFeed } from "@/components/dashboard/PulsoFeed";
import { OrigemLeads } from "@/components/dashboard/OrigemLeads";
import { ExportarBotao } from "@/components/dashboard/ExportarBotao";
import { NovoLeadButton } from "@/components/dashboard/NovoLeadButton";
import {
  getDashboard,
  getPerfil,
  getTracao,
  getPulso,
  getPlanoAtual,
} from "@/lib/supabase/crm-data";
import { getSessao } from "@/lib/supabase/tenant";
import { planoTemFeature } from "@/lib/planos/features";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function PainelPage() {
  // Superadmin sem cliente selecionado vai direto para o painel de admin.
  const sessao = await getSessao();
  if (sessao.papel === "superadmin" && !sessao.impersonating) redirect("/admin");

  const [m, perfil, tracao, pulso, plano] = await Promise.all([
    getDashboard(),
    getPerfil(),
    getTracao(),
    getPulso(),
    getPlanoAtual(),
  ]);
  const cliente = perfil.nome || "bem-vindo";
  const mostrarAnuncios = planoTemFeature(plano, "anuncios");
  return (
    <>
      {/* Cabeçalho */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Bem-vindo ao Centro de Comando,{" "}
            <span className="text-marca">{cliente}</span>.
          </h1>
          <p className="mt-1 text-texto-suave">
            Sua máquina de vendas operando em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportarBotao />
          <NovoLeadButton />
        </div>
      </header>

      {/* Bloco 1: Métricas de Ouro */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          titulo="Investimento em Tráfego"
          valor={brl(m.investimento)}
          microcopy="O combustível da sua máquina nos últimos 30 dias."
          icon={DollarSign}
        />
        <MetricCard
          titulo="Novos Leads Capturados"
          valor={String(m.totalLeads)}
          microcopy="Pessoas que demonstraram interesse no seu serviço."
          icon={Users}
        />
        <MetricCard
          titulo="Leads Qualificados (IA)"
          valor={String(m.qualificados)}
          selo="alta intenção"
          microcopy="Filtrados e prontos para fechamento. Zero perda de tempo."
          icon={Sparkles}
          destaque
        />
        <MetricCard
          titulo="Agendamentos Confirmados"
          valor={String(m.agendamentos)}
          microcopy="Clientes com horário marcado. Dinheiro na mesa."
          icon={CalendarCheck}
        />
        <MetricCard
          titulo="Custo por Agendamento"
          valor={brl(m.cpa)}
          microcopy="Quanto você pagou para cada cliente sentar na sua cadeira."
          icon={Target}
        />
      </section>

      {/* Bloco 2 + 3: Gráfico e Pulso */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TracaoChart dados={tracao} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-1">
          {mostrarAnuncios && (
            <OrigemLeads pagos={m.pagos} organicos={m.organicos} topAnuncios={m.topAnuncios} />
          )}
          <PulsoFeed eventos={pulso} />
        </div>
      </section>

      {/* Banner de Onboarding */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-borda bg-superficie px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-marca-suave text-marca">
            <GraduationCap size={20} />
          </span>
          <p className="text-sm text-texto">
            Quer extrair o máximo do seu Centro de Comando?
          </p>
        </div>
        <Link
          href="/universidade"
          className="rounded-sm border border-marca px-4 py-2 text-sm font-semibold text-marca transition-colors hover:bg-marca-suave"
        >
          Assista ao Treinamento Expresso de 3 Minutos
        </Link>
      </section>
    </>
  );
}
