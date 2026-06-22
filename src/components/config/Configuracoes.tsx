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
} from "lucide-react";
import { salvarConfig } from "@/lib/supabase/crm-actions";
import type { Config } from "@/lib/supabase/crm-data";
import type { EquipeInfo } from "@/lib/team/data";
import { EquipeManager } from "./EquipeManager";
import { WhatsAppCard } from "./WhatsAppCard";

type Aba = "identidade" | "integracoes" | "equipe" | "faturamento";

const abas: { id: Aba; rotulo: string; icon: typeof Building2 }[] = [
  { id: "identidade", rotulo: "Identidade do Negócio", icon: Building2 },
  { id: "integracoes", rotulo: "Integrações e APIs", icon: Plug },
  { id: "equipe", rotulo: "Gestão de Equipe", icon: Users },
  { id: "faturamento", rotulo: "Faturamento e Plano", icon: CreditCard },
];

export function Configuracoes({
  config,
  equipeInfo,
}: {
  config: Config;
  equipeInfo: EquipeInfo;
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
          {abas.map(({ id, rotulo, icon: Icon }) => (
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

/* ---------- Aba 2: Integrações ---------- */
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
          <WhatsAppCard />
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
