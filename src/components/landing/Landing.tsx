import Link from "next/link";
import {
  ArrowRight,
  Bot,
  LayoutDashboard,
  KanbanSquare,
  MessagesSquare,
  CalendarDays,
  Workflow,
  ShieldCheck,
  Megaphone,
  Search,
  Settings,
  GraduationCap,
  Sparkles,
  CalendarCheck,
  DollarSign,
  Users,
  Target,
  Flame,
  MessageCircle,
  Mail,
  Send,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { FAQ } from "./FAQ";
import { AplicarButton } from "./AplicarButton";
import { Aplicacao } from "./Aplicacao";

// CTA principal → WhatsApp (troque pelo número real da operação)
const WHATSAPP =
  "https://wa.me/5519992657109?text=" +
  encodeURIComponent("Quero aplicar para uma Sessão Estratégica Lolze.");

const NICHOS = [
  "Clínicas",
  "Estética",
  "Academias",
  "Painel Solar",
  "Advocacia",
  "Odontologia",
  "Pet Shops",
];

export function Landing() {
  return (
    <div className="bg-bege-principal">
      {/* ===================== NAVBAR ===================== */}
      <nav className="sticky top-0 z-50 bg-bege-principal/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo variante="lockup" tom="escuro" height={26} />
          <div className="hidden items-center gap-0.5 rounded-full bg-escuro-quente p-1 lg:flex">
            {[
              ["Início", "#topo"],
              ["Solução", "#solucao"],
              ["Resultados", "#resultados"],
              ["Dúvidas", "#faq"],
            ].map(([t, h], i) => (
              <a
                key={t}
                href={h}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  i === 0
                    ? "bg-white/10 text-bege-principal"
                    : "text-bege-principal/55 hover:text-bege-principal"
                }`}
              >
                {t}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-texto transition-colors hover:text-marca sm:block"
            >
              Entrar
            </Link>
            <AplicarButton className="rounded-full border border-borda bg-superficie px-4 py-2 text-sm font-semibold text-texto transition-colors hover:border-marca hover:text-marca">
              Aplicar Agora
            </AplicarButton>
          </div>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section id="topo" className="relative px-6 pb-0 pt-14 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              "radial-gradient(50% 55% at 50% 0%, rgba(21,128,61,0.06), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-superficie px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-texto-suave">
            <span className="h-1.5 w-1.5 rounded-full bg-marca" />
            <span className="text-marca">Sistema</span>
            <span className="font-display italic lowercase tracking-normal text-texto">ativo</span>
            <span aria-hidden>·</span> Respondendo em tempo real
          </span>

          <h1 className="mt-7 font-corpo text-5xl font-semibold leading-[1.04] tracking-tight text-texto sm:text-6xl lg:text-7xl">
            Pare de <span className="font-display font-medium italic">perder vendas</span>{" "}
            no WhatsApp e{" "}
            <span className="font-display font-medium italic">sangrar o caixa</span> da sua
            empresa.
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-texto-suave">
            Implantamos uma infraestrutura de{" "}
            <span className="font-display italic text-texto">IA comercial</span> que{" "}
            <span className="font-semibold text-texto">
              atende, qualifica e agenda clientes em menos de 7 segundos,
            </span>{" "}
            transformando tráfego frio em lucro no piloto automático.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#solucao"
              className="inline-flex items-center gap-2 rounded-full bg-escuro-quente px-7 py-3.5 text-base font-semibold text-bege-principal transition-transform hover:scale-[1.03]"
            >
              Ver como funciona <ArrowRight size={18} />
            </a>
            <a
              href="#aplicacao"
              className="inline-flex items-center gap-2 rounded-full border border-borda bg-superficie px-7 py-3.5 text-base font-semibold text-texto transition-colors hover:bg-fundo"
            >
              Já quero aplicar
            </a>
          </div>
          <p className="mt-4 text-xs text-texto-suave">
            Diagnóstico gratuito · Sem contrato de fidelidade no piloto
          </p>
        </div>

        {/* Dashboard grande, cortado embaixo (estilo referência) */}
        <div
          className="relative mx-auto mt-12 max-w-6xl"
          style={{
            maskImage: "linear-gradient(to bottom, black 80%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
          }}
        >
          <DashboardMock />
        </div>
      </section>

      {/* ===================== NICHOS (trust) ===================== */}
      <section className="px-6 py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-texto-suave/70">
          Feito para negócios de serviço com agenda
        </p>
        <div className="mx-auto mt-7 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {NICHOS.map((n) => (
            <span key={n} className="flex items-center gap-2.5 text-base font-bold text-texto-suave/45">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-texto-suave/10 text-sm font-bold text-texto-suave/55">
                {n.charAt(0)}
              </span>
              {n}
            </span>
          ))}
        </div>
      </section>

      {/* ===================== CAPTAR FICOU FÁCIL ===================== */}
      <section id="solucao" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Selo>O vazamento</Selo>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="font-display text-3xl font-medium italic leading-tight text-texto sm:text-4xl">
              O seu negócio está vazando dinheiro neste exato milissegundo.
            </h2>
            <div className="lg:pb-2">
              <p className="text-texto-suave">
                Enquanto você microgerencia o atendimento, a concorrência atende seu
                lead mais rápido. Nós estancamos esse sangramento com uma linha de
                montagem implacável:
              </p>
              <a
                href="#como-trabalhamos"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-escuro-quente px-5 py-2.5 text-sm font-semibold text-bege-principal hover:scale-[1.02]"
              >
                Saber mais <ArrowRight size={15} />
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <LeadCardMock />
            <AnaliseMock />
          </div>
        </div>
      </section>

      {/* ===================== O QUE A LOLZE FAZ ===================== */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-borda bg-superficie p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <PulsoMock />
            <div>
              <Selo>A linha de montagem</Selo>
              <h2 className="font-display text-3xl font-medium italic leading-tight text-texto sm:text-4xl">
                O Ecossistema Lolze:
              </h2>
              <div className="mt-6 space-y-5">
                <Recurso
                  icon={Bot}
                  titulo="O Cão de Guarda (Filtro IA)"
                  texto="Nossa IA atende em 2 segundos, quebra objeções e descarta curiosos. Só clientes quentes avançam."
                />
                <Recurso
                  icon={LayoutDashboard}
                  titulo="O Centro de Comando (CRM)"
                  texto="Um painel visual para sua equipe. Seu vendedor só entra no chat no momento decisivo para fechar a venda."
                />
                <Recurso
                  icon={ShieldCheck}
                  titulo="Agenda Blindada (Anti-faltas)"
                  texto="Lembretes automáticos 24h e 2h antes. Reduzimos as faltas da sua clínica ou escritório a quase zero."
                />
              </div>
              <a
                href="#como-trabalhamos"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-escuro-quente px-5 py-2.5 text-sm font-semibold text-bege-principal hover:scale-[1.02]"
              >
                Saber mais <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== RESULTADOS (stats) ===================== */}
      <section id="resultados" className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Selo center>Por trás da máquina</Selo>
            <h2 className="font-display text-3xl font-medium italic text-texto sm:text-4xl">
              Feito para escalar, não para enfeitar.
            </h2>
          </div>
          <div className="mt-12 divide-y divide-borda">
            <Stat
              numero="7s"
              titulo="Tempo de resposta implacável"
              texto="O tempo máximo que seu lead espera. A IA atende, engaja e qualifica antes que ele abra o site do concorrente."
            />
            <Stat
              numero="0"
              titulo="Intervenção humana na triagem"
              texto="Sua equipe não perde mais tempo sendo 'tiradora de dúvidas'. Zero esforço com leads desqualificados."
            />
            <Stat
              numero="85%"
              titulo="Sala de máquinas transparente"
              texto="Controle absoluto do seu custo por lead e agendamento confirmado em um dashboard focado apenas no lucro."
            />
          </div>
          <p className="mt-8 text-center text-xs italic text-texto-suave/70">
            Métricas-alvo da operação. Casos reais entram aqui conforme os parceiros escalam.
          </p>
        </div>
      </section>

      {/* ===================== MONTADA PRA VOCÊ ===================== */}
      <section id="funciona" className="bg-superficie px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Selo>Sala de Máquinas</Selo>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="font-display text-3xl font-medium italic leading-tight text-texto sm:text-4xl">
              Você não precisa entender de tecnologia. Só precisa acompanhar o lucro.
            </h2>
            <p className="text-texto-suave lg:pb-2">
              Nós entregamos a chave na sua mão. Ao se tornar parceiro, sua operação
              ganha:
            </p>
          </div>

          <div className="mt-10 grid items-center gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <Passo icon={LayoutDashboard} n="01" titulo="Dashboard de Vaidade Zero" texto="Veja exatamente quanto você investiu e qual foi o custo exato de cada agendamento confirmado na semana." />
              <Passo icon={KanbanSquare} n="02" titulo="Pipeline Visual (Kanban)" texto="Arraste e solte clientes até o fechamento. Chega de esquecer quem precisava de um retorno financeiro." />
              <Passo icon={GraduationCap} n="03" titulo="Universidade Interna" texto="Treinamentos de 3 minutos já embutidos na plataforma para sua equipe extrair o máximo do sistema no primeiro dia." />
            </div>
            <BarrasMock />
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <FAQ />

      {/* ===================== COMO TRABALHAMOS ===================== */}
      <section id="como-trabalhamos" className="bg-fundo px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Selo center>Como trabalhamos</Selo>
            <h2 className="font-display text-3xl font-medium italic text-texto sm:text-4xl">
              Compromisso antes do contrato.
            </h2>
            <p className="mt-4 text-texto-suave">
              Antes de qualquer assinatura você sabe exatamente o que vai receber e
              por quanto.{" "}
              <span className="font-semibold text-texto">
                Sem letra miúda, sem fidelidade no piloto.
              </span>
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Etapa
              n="01"
              titulo="Diagnóstico"
              destaque="gratuito"
              texto="Eu analiso o seu funil atual antes de qualquer cobrança e mostro onde você está perdendo lead. Você decide se faz sentido seguir."
            />
            <Etapa
              n="02"
              titulo="Implementação"
              destaque="acompanhada"
              texto="Eu mesmo configuro a IA com o seu roteiro, sua agenda e suas regras. Sem precisar de TI interno, sem você fazendo trabalho operacional."
            />
            <Etapa
              n="03"
              titulo="Piloto"
              destaque="sem fidelidade"
              texto="Você testa o sistema rodando antes de fechar contrato longo. Se não fizer sentido para o seu negócio, sai sem multa e sem amarra."
            />
          </div>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section id="aplicacao" className="px-6 py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-marca px-8 py-16 text-center sm:px-20 sm:py-24">
          <div className="mb-6 flex flex-col items-center gap-3">
            <span className="h-0.5 w-10 rounded-full bg-bege-principal/60" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bege-principal/70">
              Decisão
            </span>
          </div>
          <h2 className="mx-auto max-w-4xl font-corpo text-3xl font-semibold leading-tight text-bege-principal sm:text-4xl lg:text-5xl">
            Sua agenda vai se lotar. A questão é: com a{" "}
            <span className="font-display font-medium italic">Lolze</span> ou com a{" "}
            <span className="font-display font-medium italic">sorte</span>?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-bege-principal/80">
            Se você atende aos requisitos acima, seu negócio está pronto. Nossa
            diretoria analisa sua aplicação e agenda uma reunião de diagnóstico gratuita.
          </p>
          <AplicarButton className="mt-9 inline-flex items-center gap-2 rounded-full bg-bege-principal px-10 py-4 text-base font-bold text-escuro-quente shadow-lg transition-transform hover:scale-[1.03]">
            Preencher Aplicação Rápida <ArrowRight size={18} />
          </AplicarButton>
          <p className="mt-4 text-xs text-bege-principal/70">
            Responda 4 perguntas rápidas e fale direto no WhatsApp.
          </p>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-bege-principal/70">
            <span className="h-1.5 w-1.5 rounded-full bg-bege-principal/80" /> Vagas limitadas por região para garantir exclusividade.
          </p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="relative overflow-hidden bg-escuro-quente px-6 pt-16">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo variante="lockup" tom="branco" height={26} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-bege-principal/50">
              A infraestrutura de aquisição que transforma cliques em clientes
              pagantes, no piloto automático.
            </p>
          </div>
          <FooterCol titulo="Navegação" links={[["Solução", "#solucao"], ["Resultados", "#resultados"], ["Como funciona", "#funciona"], ["Dúvidas", "#faq"]]} />
          <FooterCol titulo="Plataforma" links={[["Entrar", "/login"], ["Aplicar Agora", WHATSAPP]]} />
          <FooterCol titulo="Jurídico" links={[["Termos de Uso", "/termos"], ["Privacidade", "/privacidade"], ["Cookies", "/cookies"]]} />
        </div>

        <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6">
          <p className="text-xs text-bege-principal/40">
            © 2026 Lolze · Sistema de Escala · suporte.lolze@gmail.com
          </p>
          <div className="flex gap-3">
            {[MessageCircle, Mail, Send].map((Icon, i) => (
              <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-bege-principal/60 hover:text-bege-principal">
                <Icon size={15} />
              </span>
            ))}
          </div>
        </div>

        {/* Marca d'água */}
        <div className="pointer-events-none select-none text-center">
          <span className="font-marca text-[18vw] font-bold leading-none text-white/[0.03]">
            lolze
          </span>
        </div>
      </footer>

      {/* Quiz de qualificação (abre antes do WhatsApp) */}
      <Aplicacao />
    </div>
  );
}

/* ===================== HELPERS ===================== */

function Selo({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-marca ${center ? "text-center" : ""}`}>
      ● {children}
    </p>
  );
}

function Recurso({ icon: Icon, titulo, texto }: { icon: typeof Bot; titulo: string; texto: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-marca">
        <Icon size={20} />
      </span>
      <div>
        <h3 className="font-corpo text-base font-bold text-texto">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-texto-suave">{texto}</p>
      </div>
    </div>
  );
}

function Stat({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return (
    <div className="grid items-baseline gap-2 py-7 sm:grid-cols-[160px_1fr] sm:gap-8">
      <div className="font-display text-5xl font-semibold italic text-marca">{numero}</div>
      <div>
        <h3 className="font-corpo text-lg font-bold text-texto">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-texto-suave">{texto}</p>
      </div>
    </div>
  );
}

function Passo({ icon: Icon, n, titulo, texto }: { icon: typeof Search; n: string; titulo: string; texto: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-borda bg-fundo p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-marca">
        <Icon size={18} />
      </span>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm italic text-texto-suave">{n}</span>
          <h3 className="font-corpo text-base font-bold text-texto">{titulo}</h3>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-texto-suave">{texto}</p>
      </div>
    </div>
  );
}

function Etapa({
  n,
  titulo,
  destaque,
  texto,
}: {
  n: string;
  titulo: string;
  destaque: string;
  texto: string;
}) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-7">
      <div className="font-display text-3xl italic text-marca">{n}</div>
      <h3 className="mt-3 font-corpo text-lg font-bold text-texto">
        {titulo}{" "}
        <span className="font-display font-normal italic text-marca">{destaque}</span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-texto-suave">{texto}</p>
    </div>
  );
}

function FooterCol({ titulo, links }: { titulo: string; links: string[][] }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-bege-principal/40">{titulo}</p>
      <ul className="space-y-2">
        {links.map(([t, h]) => (
          <li key={t}>
            <a href={h} className="text-sm text-bege-principal/70 transition-colors hover:text-bege-principal">
              {t}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----- Mocks visuais ----- */

function BarrasMock() {
  const alturas = [45, 70, 55, 85, 62, 95, 75, 60];
  return (
    <div className="rounded-2xl border border-borda bg-fundo p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-texto">Raio-X do Funil</div>
          <div className="text-[11px] text-texto-suave">Clique → cliente, por mês</div>
        </div>
        <span className="rounded-full bg-marca-suave px-2.5 py-1 text-[11px] font-semibold text-marca">+24%</span>
      </div>
      <div className="flex h-32 items-end gap-2">
        {alturas.map((a, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${a}%`, backgroundColor: i % 2 ? "#15803D" : "#DCFCE7" }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-texto-suave">
        {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago"].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function LeadCardMock() {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-texto">Novo lead capturado</span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">🔥 Quente</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-escuro-quente text-sm font-bold text-bege-principal">M</span>
        <div>
          <div className="text-sm font-semibold text-texto">Mariana Souza</div>
          <div className="text-xs text-texto-suave">Vindo do Meta Ads · há 1 min</div>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-marca-suave/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-marca">
          <Sparkles size={12} /> Diagnóstico da IA
        </div>
        <p className="mt-1 text-xs text-texto">Urgência alta, orçamento liberado. Pronta para fechamento.</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold text-marca">R$ 4.200</span>
        <span className="rounded-md bg-marca px-3 py-1.5 text-xs font-semibold text-bege-principal">Assumir chat</span>
      </div>
    </div>
  );
}

function AnaliseMock() {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-marca-suave text-marca"><Target size={16} /></span>
        <div>
          <div className="text-sm font-bold text-texto">Conversão do funil</div>
          <div className="text-[11px] text-texto-suave">Últimos 30 dias</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Cliques", "5.300", Megaphone],
          ["Qualificados", "1.710", Bot],
          ["Vendas", "224", CalendarCheck],
        ].map(([l, v, Ic]) => {
          const Icon = Ic as typeof Bot;
          return (
            <div key={l as string} className="rounded-lg border border-borda bg-fundo p-3">
              <Icon size={14} className="text-texto-suave" />
              <div className="mt-1.5 text-base font-bold text-texto">{v as string}</div>
              <div className="text-[10px] text-texto-suave">{l as string}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-end gap-1.5">
        {[40, 60, 48, 72, 55, 84, 68].map((h, i) => (
          <div key={i} className="flex-1 rounded-t" style={{ height: `${h}px`, backgroundColor: i % 2 ? "#15803D" : "#DCFCE7" }} />
        ))}
      </div>
    </div>
  );
}

function PulsoMock() {
  const itens: { c: string; t: React.ReactNode; Icon: typeof Bot }[] = [
    { c: "bg-marca-suave text-marca", Icon: CalendarCheck, t: <><b>Carlos Silva</b> teve reunião agendada pela IA.</> },
    { c: "bg-orange-100 text-orange-600", Icon: Flame, t: <><b>Roberto Dias</b> é Lead Quente. Pronto para fechar.</> },
    { c: "bg-marca-suave text-marca", Icon: DollarSign, t: <><b>Eduardo Tavares</b> fechou negócio.</> },
    { c: "bg-marca-suave text-marca", Icon: Users, t: <><b>Patrícia Gomes</b> entrou no funil pelo Site.</> },
  ];
  return (
    <div className="rounded-2xl border border-borda bg-fundo p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-marca" />
        </span>
        <span className="text-sm font-bold text-texto">Pulso da Operação</span>
        <span className="text-xs text-texto-suave">(Ao Vivo)</span>
      </div>
      <div className="space-y-3">
        {itens.map((it, i) => (
          <div key={i} className="flex gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.c}`}>
              <it.Icon size={15} />
            </span>
            <p className="text-sm leading-snug text-texto">{it.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mockup grande no estilo da referência: rail de ícones, topo, abas e 3 cards. */
function DashboardMock() {
  const rail = [LayoutDashboard, KanbanSquare, MessagesSquare, CalendarDays, Workflow];
  const pulso = [
    { c: "bg-marca-suave", nome: "Carlos Silva", acao: "Reunião agendada pela IA", valor: "R$ 5.000" },
    { c: "bg-orange-100", nome: "Roberto Dias", acao: "Lead Quente, pronto para fechar", valor: "R$ 3.600" },
    { c: "bg-marca-suave", nome: "Eduardo Tavares", acao: "Fechou negócio", valor: "R$ 6.800" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-borda bg-fundo shadow-2xl">
      {/* Barra do navegador */}
      <div className="flex items-center gap-1.5 border-b border-borda bg-superficie px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-marca" />
        <span className="mx-auto rounded-md bg-fundo px-4 py-1 text-[10px] text-texto-suave">painel.lolze.com</span>
      </div>

      <div className="flex">
        {/* Rail de ícones */}
        <aside className="flex w-12 shrink-0 flex-col items-center gap-4 bg-superficie py-4">
          <Logo variante="simbolo" tom="escuro" height={20} />
          <div className="space-y-2.5">
            {rail.map((Icon, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  i === 0 ? "bg-marca text-bege-principal" : "text-texto-suave"
                }`}
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1 p-5 text-left">
          {/* Topo */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-lg font-medium italic leading-tight text-texto">
                Raio-X da Operação
              </div>
              <div className="text-[10px] text-texto-suave">Aquisição em tempo real</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 py-1.5 text-[10px] text-texto-suave md:flex">
                <Search size={11} /> Buscar tudo...
              </div>
              <span className="rounded-lg border border-borda bg-superficie px-2.5 py-1.5 text-[10px] text-texto-suave">Sáb, 14 Jun</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-escuro-quente text-bege-principal">
                <Settings size={12} />
              </span>
            </div>
          </div>

          {/* Abas */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-superficie p-1">
              {["Visão Geral", "Pipeline", "Agenda", "Funil"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-md px-3 py-1 text-[10px] font-semibold ${
                    i === 0 ? "bg-marca text-bege-principal" : "text-texto-suave"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 rounded-lg bg-marca px-3 py-1.5 text-[10px] font-semibold text-bege-principal">
              Exportar <ArrowRight size={10} />
            </span>
          </div>

          {/* 3 cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Card 1: meta + barras */}
            <div className="rounded-xl border border-borda bg-superficie p-3">
              <div className="text-[10px] font-bold text-texto">Meta de Conversão</div>
              <div className="mt-1 text-2xl font-bold text-texto">
                86<span className="text-marca">%</span>
              </div>
              <div className="text-[9px] text-texto-suave">Melhor que o mês passado</div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {[40, 65, 50, 80, 60, 92, 72].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: i % 2 ? "#15803D" : "#DCFCE7" }} />
                ))}
              </div>
            </div>

            {/* Card 2: pulso/atividade */}
            <div className="rounded-xl border border-borda bg-superficie p-3">
              <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-texto">
                <span className="h-1.5 w-1.5 rounded-full bg-marca" /> Pulso da Operação
              </div>
              <div className="space-y-2.5">
                {pulso.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`h-6 w-6 shrink-0 rounded-full ${p.c}`} />
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold text-texto">{p.nome}</div>
                      <div className="truncate text-[8px] text-texto-suave">{p.acao}</div>
                    </div>
                    <span className="ml-auto text-[9px] font-bold text-marca">{p.valor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: faturamento (destaque) */}
            <div className="rounded-xl border border-marca/30 bg-marca-suave p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-texto">Faturamento do Mês</div>
                <span className="rounded-full bg-white/60 px-1.5 py-px text-[8px] font-semibold text-marca">87%</span>
              </div>
              <div className="mt-1 text-[9px] text-texto-suave">Cliente: Dr. Ricardo</div>
              <div className="mt-7 text-xl font-bold text-texto">
                R$ 24.120
                <span className="text-[10px] font-medium text-texto-suave"> /R$ 32.200</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/60">
                <div className="h-full rounded-full bg-marca" style={{ width: "75%" }} />
              </div>
              <div className="mt-1.5 text-[8px] text-texto-suave">Faturamento estimado</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
