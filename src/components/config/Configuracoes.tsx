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
  FileDown,
  Bot,
} from "lucide-react";
import { salvarConfig } from "@/lib/supabase/crm-actions";
import type { Config } from "@/lib/supabase/crm-data";
import type { EquipeInfo } from "@/lib/team/data";
import { EquipeManager } from "./EquipeManager";

type Aba = "identidade" | "persona" | "integracoes" | "equipe" | "faturamento";

const abas: { id: Aba; rotulo: string; icon: typeof Building2 }[] = [
  { id: "identidade", rotulo: "Identidade do Negócio", icon: Building2 },
  { id: "persona", rotulo: "Persona da IA (SDR)", icon: Bot },
  { id: "integracoes", rotulo: "Integrações e APIs", icon: Plug },
  { id: "equipe", rotulo: "Gestão de Equipe", icon: Users },
  { id: "faturamento", rotulo: "Faturamento e Plano", icon: CreditCard },
];

export function Configuracoes({
  config,
  equipeInfo,
  ehAdmin = false,
}: {
  config: Config;
  equipeInfo: EquipeInfo;
  ehAdmin?: boolean;
}) {
  const [aba, setAba] = useState<Aba>("identidade");
  const [cfg, setCfg] = useState<Config>(config);
  const [salvo, setSalvo] = useState(false);

  // A Persona (cérebro do SDR) é gerenciada só pelo admin — o cliente não vê
  // (evita alterações indevidas). O admin edita ao "Entrar como" o cliente.
  const abasVisiveis = abas.filter((a) => a.id !== "persona" || ehAdmin);

  async function salvar() {
    await salvarConfig(cfg).catch(() => {});
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Sala de Máquinas
          </h1>
          <p className="mt-1 text-texto-suave">
            Gerencie suas integrações, permissões de equipe e o coração da sua
            operação.
          </p>
        </div>
        <button
          onClick={salvar}
          className={`flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors ${
            salvo
              ? "bg-marca-suave text-marca"
              : "bg-marca text-bege-principal hover:scale-[1.02]"
          }`}
        >
          {salvo ? <Check size={16} /> : <Save size={16} />}
          {salvo ? "Salvo!" : "Salvar Todas as Alterações"}
        </button>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Menu interno */}
        <nav className="flex shrink-0 gap-1 md:w-60 md:flex-col">
          {abasVisiveis.map(({ id, rotulo, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                aba === id
                  ? "bg-marca-suave text-marca"
                  : "text-texto-suave hover:bg-superficie hover:text-texto"
              }`}
            >
              <Icon size={17} /> {rotulo}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {aba === "identidade" && <Identidade cfg={cfg} setCfg={setCfg} />}
          {aba === "persona" && ehAdmin && <Persona cfg={cfg} setCfg={setCfg} />}
          {aba === "integracoes" && <Integracoes />}
          {aba === "equipe" && <EquipeManager info={equipeInfo} />}
          {aba === "faturamento" && <Faturamento />}
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
        className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
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

/* ---------- Aba 2: Persona da IA ---------- */
function CampoArea({
  label,
  valor,
  onChange,
  micro,
  placeholder,
  linhas = 4,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  micro?: string;
  placeholder?: string;
  linhas?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-texto">{label}</label>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={linhas}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm leading-relaxed text-texto outline-none placeholder:text-texto-suave/60 focus:border-marca"
      />
      {micro && <p className="mt-1 text-xs text-texto-suave">{micro}</p>}
    </div>
  );
}

function Persona({ cfg, setCfg }: { cfg: Config; setCfg: (c: Config) => void }) {
  const set = (k: keyof Config) => (v: string) => setCfg({ ...cfg, [k]: v });
  return (
    <div className="space-y-6">
      <Painel
        titulo="Cérebro do seu SDR de IA"
        micro="Tudo aqui vira o roteiro que a inteligência usa para atender, qualificar e quebrar objeções dos seus leads. Quanto mais específico, mais afiada a venda."
      >
        {/* Interruptor mestre */}
        <div className="mb-5 flex items-center justify-between rounded-lg border border-borda bg-fundo p-4">
          <div>
            <p className="text-sm font-bold text-texto">Atendimento automático</p>
            <p className="text-xs text-texto-suave">
              {cfg.agenteAtivo
                ? "A IA está atendendo os leads que chegam. Desligue para responder só no manual."
                : "A IA está pausada. Os leads ficam aguardando atendimento humano."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCfg({ ...cfg, agenteAtivo: !cfg.agenteAtivo })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              cfg.agenteAtivo ? "bg-marca" : "bg-borda"
            }`}
            aria-pressed={cfg.agenteAtivo}
            aria-label="Ativar atendimento automático"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-bege-principal transition-transform ${
                cfg.agenteAtivo ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <CampoArea
            label="Oferta principal"
            valor={cfg.oferta}
            onChange={set("oferta")}
            placeholder="O que você vende, para quem, e o principal benefício. Ex: Harmonização facial a partir de R$ 1.200, foco em resultado natural e sem dor."
            micro="A IA usa isto para conectar a dor do lead ao seu serviço. Não inclua preços que você não quer que ela cite."
          />
          <CampoArea
            label="Público-alvo"
            valor={cfg.publico}
            onChange={set("publico")}
            linhas={3}
            placeholder="Quem é o cliente ideal e o que ele costuma buscar. Ex: mulheres 30–50 anos preocupadas com sinais de idade, que valorizam discrição."
          />
          <CampoArea
            label="Tom de voz"
            valor={cfg.tom}
            onChange={set("tom")}
            linhas={3}
            placeholder="Como a IA deve soar. Ex: acolhedora e consultiva, trata por você, sem gírias, sem pressão. Usa o primeiro nome do lead."
          />
          <CampoArea
            label="Objeções comuns e como responder"
            valor={cfg.objecoes}
            onChange={set("objecoes")}
            linhas={5}
            placeholder={'"Está caro" → mostrar valor e parcelamento.\n"Vou pensar" → criar urgência leve e oferecer agendar uma avaliação sem compromisso.\n"Tenho medo de doer" → explicar o protocolo de conforto.'}
            micro="Uma objeção por linha, com a resposta que converte. É aqui que o SDR ganha ou perde a venda."
          />
          <CampoArea
            label="Perguntas frequentes"
            valor={cfg.faq}
            onChange={set("faq")}
            linhas={4}
            placeholder={"Onde fica? → Endereço.\nQuanto tempo dura? → ...\nTem garantia? → ..."}
          />
          <CampoArea
            label="Regras e limites (o que NÃO fazer)"
            valor={cfg.regras}
            onChange={set("regras")}
            linhas={3}
            placeholder="Ex: nunca prometer resultado garantido; nunca passar preço de procedimento X; se perguntarem de convênio, dizer que não atendemos."
            micro="Guardrails do seu negócio. A IA já é proibida de inventar preço ou fazer promessa médica garantida."
          />
        </div>
      </Painel>
    </div>
  );
}

/* ---------- Aba 3: Integrações ---------- */
function StatusBadge({ on, texto }: { on: boolean; texto: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        on ? "bg-marca-suave text-marca" : "bg-red-100 text-red-600"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-marca" : "bg-red-500"}`} />
      {texto}
    </span>
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
    <div className="rounded-lg border border-borda bg-fundo p-4">
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

function Integracoes() {
  const [agendaOn, setAgendaOn] = useState(false);

  return (
    <Painel
      titulo="Conexões Externas"
      micro="Conecte suas ferramentas e deixe o sistema orquestrar o fluxo de dados por você. Sem códigos complexos."
    >
      <div className="space-y-4">
        <CardIntegracao icon={MessageSquare} titulo="WhatsApp Oficial">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <StatusBadge on texto="Conectado e Operante" />
              <p className="mt-1.5 text-sm text-texto">+55 11 99999-9999</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-borda px-3 py-1.5 text-xs font-semibold text-texto hover:bg-superficie">
                Ler Novo QR Code
              </button>
              <button className="rounded-md border border-borda px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                Desconectar
              </button>
            </div>
          </div>
        </CardIntegracao>

        <CardIntegracao icon={CalendarSync} titulo="Sincronização de Agenda">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <StatusBadge
                on={agendaOn}
                texto={agendaOn ? "Conectado e Operante" : "Aguardando Conexão"}
              />
              <p className="mt-1.5 text-xs text-texto-suave">
                Integre com o Google Calendar para a IA realizar e bloquear
                agendamentos em tempo real.
              </p>
            </div>
            <button
              onClick={() => setAgendaOn((v) => !v)}
              className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${
                agendaOn
                  ? "border border-borda text-texto hover:bg-superficie"
                  : "bg-marca text-bege-principal"
              }`}
            >
              {agendaOn ? "Desconectar" : "Sincronizar com Google Calendar"}
            </button>
          </div>
        </CardIntegracao>

        <CardIntegracao icon={Target} titulo="Tráfego e Rastreamento">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge on texto="Pixel Ativo" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-texto-suave">ID do Pixel da Meta:</span>
              <input
                defaultValue="612873490012345"
                className="w-44 rounded-md border border-borda bg-superficie px-2 py-1.5 text-xs text-texto outline-none focus:border-marca"
              />
            </div>
          </div>
        </CardIntegracao>
      </div>
    </Painel>
  );
}

/* ---------- Aba 4: Faturamento ---------- */
function Faturamento() {
  return (
    <Painel
      titulo="Sua Assinatura"
      micro="Transparência total sobre seu investimento no nosso ecossistema."
    >
      <div className="rounded-lg border border-marca/30 bg-marca-suave/40 p-5">
        <div className="flex items-center justify-between">
          <span className="font-corpo text-lg font-bold text-texto">
            Plano Escala VIP
          </span>
          <span className="rounded-full bg-marca px-2.5 py-0.5 text-xs font-semibold text-bege-principal">
            Ativo
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-texto-suave">Próxima Cobrança</dt>
            <dd className="text-sm font-semibold text-texto">
              R$ 2.997 em 01/07/2026
            </dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Cartão Vinculado</dt>
            <dd className="text-sm font-semibold text-texto">
              Mastercard final **** 1234
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo">
          Atualizar Método de Pagamento
        </button>
        <button className="flex items-center gap-2 rounded-md border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo">
          <FileDown size={15} /> Baixar Notas Fiscais / Recibos
        </button>
      </div>
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
    <div className="rounded-lg border border-borda bg-superficie p-6">
      <h2 className="font-corpo text-lg font-bold text-texto">{titulo}</h2>
      <p className="mb-5 mt-1 text-sm text-texto-suave">{micro}</p>
      {children}
    </div>
  );
}
