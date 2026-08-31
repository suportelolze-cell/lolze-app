import { DollarSign, Users, Sparkles, CalendarCheck, Target, CheckCircle2, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader, Acento } from "@/components/ui";
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
import { lerPlaybook } from "@/lib/playbook";
import { getResumoVendas } from "@/lib/vendas/data";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function PainelPage() {
  // Superadmin sem cliente selecionado vai direto para o painel de admin.
  const sessao = await getSessao();
  if (sessao.papel === "superadmin" && !sessao.impersonating) redirect("/admin");

  const [m, perfil, tracao, pulso, plano, playbook] = await Promise.all([
    getDashboard(),
    getPerfil(),
    getTracao(),
    getPulso(),
    getPlanoAtual(),
    lerPlaybook(),
  ]);
  const infoproduto = playbook === "infoproduto";
  // Vendas do mesmo período das demais métricas (30 dias) — só para infoproduto.
  const vendas = infoproduto ? (await getResumoVendas(30)).resumo : null;
  const cliente = perfil.nome || "bem-vindo";
  const mostrarAnuncios = planoTemFeature(plano, "anuncios");
  // Investimento e CPA vêm de app_trafego (integração de Ads). Sem dado real,
  // ambos seriam R$0 fixo — esconder é mais honesto do que mostrar zero como se
  // fosse resultado. Voltam sozinhos quando houver investimento sincronizado.
  const temTrafego = m.investimento > 0;
  return (
    <>
      {/* Cabeçalho */}
      <PageHeader
        titulo={
          <>
            Bem-vindo, <Acento>{cliente}</Acento>
          </>
        }
        descricao="Sua máquina de vendas operando em tempo real."
        acao={
          <>
            <ExportarBotao />
            <NovoLeadButton />
          </>
        }
      />


      {/* Bloco 1: Métricas de Ouro. O painel se adapta ao playbook do tenant:
          serviço local foca em agendamento; infoproduto foca em venda. Em ambos,
          Investimento/CPA só aparecem quando há dado real de tráfego (app_trafego)
          — senão mostrariam R$0 fixo (métrica vazia apresentada como real). */}
      {infoproduto ? (
        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            titulo="Faturado (30 dias)"
            valor={brl((vendas?.faturadoCents ?? 0) / 100)}
            microcopy="Soma das vendas aprovadas no período."
            icon={DollarSign}
            destaque
          />
          <MetricCard
            titulo="Novos Leads Capturados"
            valor={String(m.totalLeads)}
            microcopy="Pessoas que entraram em contato ou compraram."
            icon={Users}
          />
          <MetricCard
            titulo="Leads Qualificados (IA)"
            valor={String(m.qualificados)}
            selo="alta intenção"
            microcopy="Filtrados pela IA e prontos para fechar."
            icon={Sparkles}
          />
          <MetricCard
            titulo="Vendas Aprovadas"
            valor={String(vendas?.aprovadas ?? 0)}
            microcopy="Compras confirmadas no período."
            icon={CheckCircle2}
          />
          <MetricCard
            titulo="Pagamentos Pendentes"
            valor={String(vendas?.pendentes ?? 0)}
            microcopy="PIX e boletos aguardando. Dá para recuperar."
            icon={Clock}
          />
        </section>
      ) : (
        <section
          className={`mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 ${
            temTrafego ? "lg:grid-cols-5" : "lg:grid-cols-3"
          }`}
        >
          {temTrafego && (
            <MetricCard
              titulo="Investimento em Tráfego"
              valor={brl(m.investimento)}
              microcopy="O combustível da sua máquina nos últimos 30 dias."
              icon={DollarSign}
            />
          )}
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
          {temTrafego && (
            <MetricCard
              titulo="Custo por Agendamento"
              valor={brl(m.cpa)}
              microcopy="Quanto você pagou para cada cliente sentar na sua cadeira."
              icon={Target}
            />
          )}
        </section>
      )}

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
    </>
  );
}
