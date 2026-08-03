import { DollarSign, Users, Sparkles, CalendarCheck, Target } from "lucide-react";
import { redirect } from "next/navigation";
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
  // Investimento e CPA vêm de app_trafego (integração de Ads). Sem dado real,
  // ambos seriam R$0 fixo — esconder é mais honesto do que mostrar zero como se
  // fosse resultado. Voltam sozinhos quando houver investimento sincronizado.
  const temTrafego = m.investimento > 0;
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

      {/* Bloco 1: Métricas de Ouro. Investimento/CPA só aparecem quando há dado
          real de tráfego (app_trafego) — senão mostrariam R$0 fixo (métrica
          vazia apresentada como real). Reaparecem sozinhos com a sync de Ads. */}
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
