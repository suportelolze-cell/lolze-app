"use client";

import { useState } from "react";
import {
  Building2,
  Plug,
  Users,
  CreditCard,
  Save,
  Check,
  MessageSquare,
  CalendarSync,
  Target,
  ShoppingCart,
  PackageCheck,
  FileDown,
  Radar,
  BookOpen,
  Gauge,
} from "lucide-react";
import { salvarConfig, salvarRespostasRapidas } from "@/lib/supabase/crm-actions";
import { assinarPlano, gerenciarAssinatura } from "@/lib/billing/actions";
import type { BillingInfo } from "@/lib/billing/data";
import type { Config } from "@/lib/supabase/crm-data";
import type { EquipeInfo } from "@/lib/team/data";
import { EquipeManager } from "./EquipeManager";
import { ConhecimentoCard } from "./ConhecimentoCard";
import { BibliotecaMidiaCard } from "./BibliotecaMidiaCard";
import type { KbFile } from "@/lib/kb/data";
import type { ItemBiblioteca } from "@/lib/biblioteca/data";
import { AtendimentoCard } from "./AtendimentoCard";
import type { AtendimentoCfg } from "@/lib/supabase/crm-data";
import { WhatsAppCard } from "./WhatsAppCard";
import { IaSwitchCard } from "./IaSwitchCard";
import { CaptacaoNumerosCard } from "./CaptacaoNumerosCard";
import { CheckoutIntegracoes } from "./CheckoutIntegracoes";
import { EntregaCard } from "./EntregaCard";
import { PlaybookCard } from "./PlaybookCard";
import { desconectarGoogle } from "@/lib/google/actions";
import type { GoogleStatus } from "@/lib/google/oauth";
import { PageHeader, Acento, Button, Badge, StatusDot, buttonClasses } from "@/components/ui";

type Aba = "identidade" | "integracoes" | "conhecimento" | "equipe" | "faturamento";

const abas: { id: Aba; rotulo: string; icon: typeof Building2 }[] = [
  { id: "identidade", rotulo: "Identidade do Negócio", icon: Building2 },
  { id: "integracoes", rotulo: "Integrações e APIs", icon: Plug },
  { id: "conhecimento", rotulo: "Base de Conhecimento", icon: BookOpen },
  { id: "equipe", rotulo: "Gestão de Equipe", icon: Users },
  { id: "faturamento", rotulo: "Faturamento e Plano", icon: CreditCard },
];

export function Configuracoes({
  config,
  equipeInfo,
  respostasRapidas = "",
  billing,
  google,
  atendimento,
  iaAtiva = true,
  numerosCaptacao,
  docsKb = [],
  biblioteca = [],
}: {
  config: Config;
  equipeInfo: EquipeInfo;
  respostasRapidas?: string;
  billing: BillingInfo;
  google?: GoogleStatus;
  atendimento?: AtendimentoCfg;
  iaAtiva?: boolean;
  numerosCaptacao?: { instancias: string[]; max: number };
  docsKb?: KbFile[];
  biblioteca?: ItemBiblioteca[];
}) {
  const [aba, setAba] = useState<Aba>("identidade");
  const [cfg, setCfg] = useState<Config>(config);
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    await salvarConfig(cfg).catch(() => {});
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        titulo={
          <>
            Sala de <Acento>Máquinas</Acento>
          </>
        }
        descricao="Gerencie suas integrações, permissões de equipe e o coração da sua operação."
        acao={
          <Button variant={salvo ? "verde" : "primary"} onClick={salvar}>
            {salvo ? <Check size={16} /> : <Save size={16} />}
            {salvo ? "Salvo!" : "Salvar Todas as Alterações"}
          </Button>
        }
      />

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Menu interno */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-60 md:flex-col md:overflow-visible">
          {abas.map(({ id, rotulo, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                aba === id
                  ? "bg-marca-suave text-marca"
                  : "text-texto-suave hover:bg-fundo-2 hover:text-texto"
              }`}
            >
              <Icon size={17} /> {rotulo}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {aba === "identidade" && (
            <div className="flex flex-col gap-6">
              {equipeInfo.podeGerenciar && (
                <Painel
                  titulo="Tipo de operação"
                  micro="Serviço local ou produtor de infoproduto. Ajusta o roteiro do agente de IA."
                >
                  <PlaybookCard />
                </Painel>
              )}
              <Identidade cfg={cfg} setCfg={setCfg} />
              <RespostasRapidasPanel inicial={respostasRapidas} />
            </div>
          )}
          {aba === "integracoes" && (
            <Integracoes
              google={google}
              iaAtiva={iaAtiva}
              numerosCaptacao={numerosCaptacao}
              podeGerenciar={equipeInfo.podeGerenciar}
            />
          )}
          {aba === "equipe" && (
            <div className="space-y-6">
              <EquipeManager info={equipeInfo} />
              <AtendimentoCard inicial={atendimento ?? { especialista: "", abre: 8, fecha: 18 }} />
            </div>
          )}
          {aba === "conhecimento" && (
            <div className="space-y-6">
              <ConhecimentoCard docs={docsKb} />
              <BibliotecaMidiaCard inicial={biblioteca} />
            </div>
          )}
          {aba === "faturamento" && <Faturamento billing={billing} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Aba 1: Identidade ---------- */
function Campo({
  label,
  valor,
  onChange,
  micro,
  largo,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  micro?: string;
  largo?: boolean;
}) {
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-semibold text-texto">
        {label}
      </label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none transition-colors focus:border-marca"
      />
      {micro && <p className="mt-1 text-xs text-texto-suave">{micro}</p>}
    </div>
  );
}

function Identidade({
  cfg,
  setCfg,
}: {
  cfg: Config;
  setCfg: (c: Config) => void;
}) {
  const set = (k: keyof Config) => (v: string) => setCfg({ ...cfg, [k]: v });
  return (
    <Painel
      titulo="Dados da Empresa"
      micro="Informações públicas que nossa inteligência utilizará no atendimento aos seus clientes."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo label="Nome do Negócio" valor={cfg.nomeNegocio} onChange={set("nomeNegocio")} />
        <Campo label="E-mail Principal" valor={cfg.email} onChange={set("email")} />
        <Campo
          label="Endereço Físico"
          valor={cfg.endereco}
          onChange={set("endereco")}
          micro="A IA enviará este endereço automaticamente quando solicitada."
          largo
        />
        <Campo label="Horário de Funcionamento" valor={cfg.horario} onChange={set("horario")} />
      </div>
    </Painel>
  );
}

/* ---------- Aba 2: Integrações ---------- */
function StatusBadge({ on, texto }: { on: boolean; texto: string }) {
  return (
    <Badge tom={on ? "menta" : "erro"}>
      <StatusDot tom={on ? "menta" : "erro"} /> {texto}
    </Badge>
  );
}

function CardIntegracao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: typeof MessageSquare;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-borda bg-fundo-2 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-superficie text-texto">
          <Icon size={18} />
        </span>
        <h3 className="text-sm font-bold text-texto">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Integracoes({
  google,
  iaAtiva = true,
  numerosCaptacao,
  podeGerenciar = false,
}: {
  google?: GoogleStatus;
  iaAtiva?: boolean;
  numerosCaptacao?: { instancias: string[]; max: number };
  podeGerenciar?: boolean;
}) {
  const googleConfigurado = google?.configurado ?? false;
  const googleConectado = google?.conectado ?? false;

  return (
    <Painel
      titulo="Conexões Externas"
      micro="Conecte suas ferramentas e deixe o sistema orquestrar o fluxo de dados por você. Sem códigos complexos."
    >
      <div className="space-y-4">
        <IaSwitchCard inicial={iaAtiva} />

        {podeGerenciar && numerosCaptacao && numerosCaptacao.max > 0 && (
          <CardIntegracao icon={Radar} titulo="Números de Captação (prospecção)">
            <CaptacaoNumerosCard instancias={numerosCaptacao.instancias} max={numerosCaptacao.max} />
          </CardIntegracao>
        )}

        <CardIntegracao icon={MessageSquare} titulo="WhatsApp Oficial">
          <WhatsAppCard />
        </CardIntegracao>

        {podeGerenciar && (
          <CardIntegracao icon={ShoppingCart} titulo="Vendas e Checkout">
            <CheckoutIntegracoes />
          </CardIntegracao>
        )}

        {podeGerenciar && (
          <CardIntegracao icon={PackageCheck} titulo="Entrega automática">
            <EntregaCard />
          </CardIntegracao>
        )}

        <CardIntegracao icon={CalendarSync} titulo="Sincronização de Agenda">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <StatusBadge
                on={googleConectado}
                texto={
                  googleConectado
                    ? `Conectado${google?.email ? ` · ${google.email}` : ""}`
                    : googleConfigurado
                      ? "Aguardando Conexão"
                      : "Não configurada"
                }
              />
              <p className="mt-1.5 text-xs text-texto-suave">
                {googleConfigurado
                  ? "Conecte o Google Calendar: a IA importa os compromissos que já existem, não marca em horário ocupado e cria os agendamentos lá automaticamente."
                  : "Integração indisponível: faltam as credenciais do Google (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET) no servidor."}
              </p>
            </div>

            {googleConectado ? (
              <form action={desconectarGoogle} className="shrink-0">
                <Button type="submit" variant="secondary" size="sm">
                  Desconectar
                </Button>
              </form>
            ) : (
              <a
                href={googleConfigurado ? "/api/google/start" : undefined}
                aria-disabled={!googleConfigurado}
                className={
                  googleConfigurado
                    ? buttonClasses("verde", "sm", "shrink-0")
                    : "pointer-events-none shrink-0 cursor-not-allowed rounded-pill bg-fundo-2 px-4 py-2 text-xs font-semibold text-texto-suave"
                }
              >
                Sincronizar com Google Calendar
              </a>
            )}
          </div>
        </CardIntegracao>

        <CardIntegracao icon={Target} titulo="Tráfego e Rastreamento">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge on={false} texto="Pixel não configurado" />
            <span className="text-xs text-texto-suave">
              Rastreamento por Pixel da Meta ainda não disponível nesta conta.
            </span>
          </div>
        </CardIntegracao>
      </div>
    </Painel>
  );
}

/* ---------- Aba 4: Faturamento ---------- */
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_INFO: Record<string, { rotulo: string; classe: string }> = {
  ativo: { rotulo: "Ativo", classe: "bg-marca text-bege-principal" },
  inadimplente: { rotulo: "Pagamento pendente", classe: "bg-amber-500 text-white" },
  cancelado: { rotulo: "Cancelado", classe: "bg-red-500 text-white" },
};

function Faturamento({ billing }: { billing: BillingInfo }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const st = STATUS_INFO[billing.status] ?? { rotulo: billing.status || "—", classe: "bg-fundo text-texto-suave" };

  async function ir(promessa: Promise<{ url?: string; erro?: string }>) {
    setErro("");
    setCarregando(true);
    try {
      const r = await promessa;
      if (r.url) window.location.href = r.url;
      else setErro(r.erro ?? "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Painel titulo="Sua Assinatura" micro="Seu plano e pagamento, com total transparência.">
      <div className="rounded-lg border border-marca/30 bg-marca-suave/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-corpo text-lg font-bold text-texto">
            Plano {billing.planoNome || "—"}
          </span>
          <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${st.classe}`}>
            {st.rotulo}
          </span>
        </div>
        {billing.mensalCents > 0 && (
          <p className="mt-2 text-sm text-texto-suave">
            <strong className="text-texto">{brl(billing.mensalCents)}</strong> / mês
          </p>
        )}
      </div>

      <UsoIACard billing={billing} />

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {billing.temAssinatura ? (
          <Button variant="secondary" onClick={() => ir(gerenciarAssinatura())} disabled={carregando}>
            <FileDown size={15} /> {carregando ? "Abrindo…" : "Gerenciar assinatura / notas"}
          </Button>
        ) : billing.temCheckout ? (
          <Button variant="verde" onClick={() => ir(assinarPlano())} disabled={carregando}>
            {carregando ? "Redirecionando…" : "Assinar agora"}
          </Button>
        ) : (
          <p className="text-sm text-texto-suave">
            Pagamento online ainda não habilitado nesta conta. Fale com o suporte.
          </p>
        )}
      </div>
    </Painel>
  );
}

/* ---------- Uso de IA do mês (franquia — transparência) ---------- */
function UsoIACard({ billing }: { billing: BillingInfo }) {
  const ilimitado = billing.iaTetoCents <= 0;
  const pct = billing.iaPct;
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });

  const nivel = pct >= 100 ? "cheio" : pct >= 80 ? "alto" : "ok";
  const corBarra =
    nivel === "cheio" ? "bg-red-500" : nivel === "alto" ? "bg-amber-500" : "bg-marca";
  const corRotulo =
    nivel === "cheio" ? "text-red-600" : nivel === "alto" ? "text-amber-600" : "text-texto-suave";
  const rotulo = nivel === "cheio" ? "No limite" : nivel === "alto" ? "Uso elevado" : "Dentro da franquia";

  const microcopy =
    pct === 0
      ? "Nenhum uso de IA ainda neste mês."
      : nivel === "cheio"
      ? "Você atingiu a franquia de IA deste mês. O atendimento automático pode pausar até o próximo ciclo. Fale com o suporte para ampliar seu plano."
      : nivel === "alto"
      ? "Uso elevado neste mês. Se chegar a 100%, o atendimento por IA pode pausar até o próximo ciclo. Fale com o suporte para ampliar."
      : "Tudo tranquilo, você está bem dentro da sua franquia de IA.";

  return (
    <div className="mt-4 rounded-lg border border-borda bg-fundo-2 p-5">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-marca" />
        <span className="text-sm font-bold capitalize text-texto">Uso de IA em {mes}</span>
      </div>

      {ilimitado ? (
        <p className="mt-2 text-sm text-texto-suave">
          Seu plano tem <strong className="text-texto">uso de IA ilimitado</strong>. 🎉
        </p>
      ) : (
        <>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-borda">
            <div
              className={`h-full rounded-full ${corBarra} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-texto">{pct}% da franquia</span>
            <span className={`text-xs font-semibold ${corRotulo}`}>{rotulo}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-texto-suave">{microcopy}</p>
        </>
      )}
    </div>
  );
}

/* ---------- Respostas rápidas (atalhos do atendimento) ---------- */
function RespostasRapidasPanel({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const r = await salvarRespostasRapidas(texto).catch(() => ({ ok: false }));
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  return (
    <Painel
      titulo="Respostas Rápidas"
      micro="Atalhos que a equipe insere no atendimento com 1 clique (botão ⚡). Uma por linha. Vazio = usa as padrão."
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder={"Olá! Tudo bem? Como posso te ajudar?\nConsigo te encaixar ainda esta semana. Prefere manhã ou tarde?"}
        className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none transition-colors focus:border-marca"
      />
      <Button variant="verde" onClick={salvar} disabled={salvando} className="mt-3">
        {salvo ? <Check size={16} /> : <Save size={16} />}
        {salvo ? "Salvo!" : salvando ? "Salvando..." : "Salvar respostas"}
      </Button>
    </Painel>
  );
}

/* ---------- Wrapper de painel ---------- */
function Painel({
  titulo,
  micro,
  children,
}: {
  titulo: string;
  micro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-6 shadow-card">
      <h2 className="font-corpo text-lg font-bold text-texto">{titulo}</h2>
      <p className="mb-5 mt-1 text-sm text-texto-suave">{micro}</p>
      {children}
    </div>
  );
}
