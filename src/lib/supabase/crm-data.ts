import { getCrmServer } from "./server";
import { getTenantId } from "./tenant";
import { urlsAssinadasMidia } from "@/lib/evolution/client";
import { ORIGEM_LABEL, type Lead, type ColunaId } from "@/lib/leads";
import type { Conversa } from "@/lib/conversas";
import type { DadosFunil, Periodo } from "@/lib/funil";

export type ClienteRecorrente = {
  leadId: number;
  nome: string;
  telefone: string;
  totalServicos: number;
  servicos30d: number;
  ultimoServicoISO: string | null;
  diasDesdeUltimo: number | null;
  cadenciaDias: number | null;
  churn: boolean;
};

export type RecorrenciaDados = {
  clientes: ClienteRecorrente[];
  totalBase: number;
  emChurn: number;
  servicosMes: number;
};

/**
 * Carteira de clientes recorrentes (Lista 2): só quem já fez ≥1 serviço.
 * Agrega os agendamentos confirmados/concluídos por cliente para o Dashboard
 * de Recorrência (frequência, churn, curva ABC).
 */
export async function getRecorrencia(): Promise<RecorrenciaDados> {
  const tid = await getTenantId();
  if (!tid) return { clientes: [], totalBase: 0, emChurn: 0, servicosMes: 0 };
  const sb = getCrmServer();

  const { data: ags } = await sb
    .from("app_agendamentos")
    .select("lead_id,inicio")
    .eq("tenant_id", tid)
    .in("status", ["confirmado", "concluido"])
    .order("inicio");

  const porLead = new Map<number, number[]>();
  for (const a of (ags ?? []) as { lead_id: number | null; inicio: string }[]) {
    if (a.lead_id == null) continue;
    const arr = porLead.get(a.lead_id) ?? [];
    arr.push(new Date(a.inicio).getTime());
    porLead.set(a.lead_id, arr);
  }
  const leadIds = Array.from(porLead.keys());
  if (leadIds.length === 0) return { clientes: [], totalBase: 0, emChurn: 0, servicosMes: 0 };

  const { data: leads } = await sb
    .from("app_leads")
    .select("id,nome,telefone")
    .eq("tenant_id", tid)
    .in("id", leadIds);
  const info = new Map(
    ((leads ?? []) as { id: number; nome: string | null; telefone: string | null }[]).map((l) => [l.id, l])
  );

  const agora = Date.now();
  const D = 86_400_000;
  let servicosMes = 0;
  const clientes: ClienteRecorrente[] = [];
  for (const [leadId, ms] of Array.from(porLead.entries())) {
    const t = ms.sort((a, b) => a - b);
    const ultimo = t[t.length - 1];
    const s30 = t.filter((x) => agora - x <= 30 * D).length;
    servicosMes += s30;
    const diasDesde = Math.floor((agora - ultimo) / D);
    let cadencia: number | null = null;
    if (t.length >= 2) {
      let soma = 0;
      for (let i = 1; i < t.length; i++) soma += (t[i] - t[i - 1]) / D;
      cadencia = Math.round(soma / (t.length - 1));
    }
    const limite = cadencia ? Math.max(cadencia * 1.3, cadencia + 7) : 30;
    const churn = diasDesde >= 7 && diasDesde > limite;
    const li = info.get(leadId);
    clientes.push({
      leadId,
      nome: li?.nome ?? "Cliente",
      telefone: li?.telefone ?? "",
      totalServicos: t.length,
      servicos30d: s30,
      ultimoServicoISO: new Date(ultimo).toISOString(),
      diasDesdeUltimo: diasDesde,
      cadenciaDias: cadencia,
      churn,
    });
  }
  clientes.sort((a, b) => b.totalServicos - a.totalServicos || (b.servicos30d - a.servicos30d));
  return {
    clientes,
    totalBase: clientes.length,
    emChurn: clientes.filter((c) => c.churn).length,
    servicosMes,
  };
}

export type AtendimentoCfg = { especialista: string; abre: number; fecha: number };

/** Número do especialista + horário de atendimento do tenant ativo. */
export async function getAtendimentoCfg(): Promise<AtendimentoCfg> {
  const tid = await getTenantId();
  if (!tid) return { especialista: "", abre: 8, fecha: 18 };
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_config")
    .select("especialista_numero,agenda_abre,agenda_fecha")
    .eq("tenant_id", tid)
    .maybeSingle();
  return {
    especialista: (data?.especialista_numero as string | null) ?? "",
    abre: Number(data?.agenda_abre ?? 8),
    fecha: Number(data?.agenda_fecha ?? 18),
  };
}

type LeadRow = {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string;
  temperatura: "quente" | "morno" | "frio";
  coluna: ColunaId;
  valor: number | null;
  ultima_msg: string | null;
  diagnostico: string | null;
};

function toLead(r: LeadRow): Lead {
  return {
    id: r.id,
    nome: r.nome,
    telefone: r.telefone ?? "",
    email: r.email ?? "",
    origem: ORIGEM_LABEL[r.origem] ?? "Site",
    temperatura: r.temperatura,
    coluna: r.coluna,
    valor: r.valor ?? undefined,
    ultimaMsg: r.ultima_msg ?? "",
    diagnostico: r.diagnostico ?? "",
  };
}

/** Perfil do usuário logado (para a saudação e gating de UI). */
export async function getPerfil() {
  const sb = getCrmServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { nome: "", email: "", papel: "" };
  const { data } = await sb
    .from("app_profiles")
    .select("nome,email,papel")
    .eq("id", user.id)
    .maybeSingle();
  return {
    nome: data?.nome || (user.email ?? "").split("@")[0],
    email: data?.email || user.email || "",
    papel: data?.papel || "owner",
  };
}

/** Pipeline: todos os leads do tenant. */
export async function getLeads(): Promise<Lead[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmServer();
  const { data, error } = await sb
    .from("app_leads")
    .select("id,nome,telefone,email,origem,temperatura,coluna,valor,ultima_msg,diagnostico")
    .eq("tenant_id", tid)
    .order("id");
  if (error) throw error;
  return (data as LeadRow[]).map(toLead);
}

/** Métricas do Dashboard (Tela 1). */
export async function getDashboard() {
  const tid = await getTenantId();
  if (!tid)
    return { investimento: 0, totalLeads: 0, qualificados: 0, agendamentos: 0, cpa: 0, pagos: 0, organicos: 0, topAnuncios: [] };
  const sb = getCrmServer();
  const [{ data: leads }, { data: trafego }] = await Promise.all([
    sb.from("app_leads").select("coluna,temperatura,aquisicao,anuncio").eq("tenant_id", tid),
    sb.from("app_trafego").select("investimento_cents,cliques").eq("tenant_id", tid),
  ]);

  const totalLeads = leads?.length ?? 0;
  const qualificados =
    leads?.filter((l) => l.coluna === "atencao" || l.coluna === "agendado" || l.coluna === "ganho").length ?? 0;
  const agendamentos =
    leads?.filter((l) => l.coluna === "agendado" || l.coluna === "ganho").length ?? 0;
  const pagos = leads?.filter((l) => l.aquisicao === "pago").length ?? 0;
  const organicos = totalLeads - pagos;
  const investimento = (trafego?.reduce((s, t) => s + (t.investimento_cents ?? 0), 0) ?? 0) / 100;
  const cpa = agendamentos > 0 ? Math.round(investimento / agendamentos) : 0;

  // Ranking: qual anúncio trouxe mais leads (só os pagos, com anúncio identificado).
  const contagem = new Map<string, number>();
  (leads ?? []).forEach((l) => {
    if (l.aquisicao === "pago" && l.anuncio)
      contagem.set(l.anuncio, (contagem.get(l.anuncio) ?? 0) + 1);
  });
  const topAnuncios = Array.from(contagem.entries())
    .map(([anuncio, leads]) => ({ anuncio, leads }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  return { investimento, totalLeads, qualificados, agendamentos, cpa, pagos, organicos, topAnuncios };
}

/** Plano do tenant logado (start | growth | scale). "" se sem tenant. */
export async function getPlanoAtual(): Promise<string> {
  const tid = await getTenantId();
  if (!tid) return "";
  const sb = getCrmServer();
  const { data } = await sb.from("app_tenants").select("plano").eq("id", tid).maybeSingle();
  return data?.plano ?? "";
}

/** Série diária (30 dias) para o gráfico "Velocidade de Tração". */
export type TracaoPonto = { dia: string; leads: number; agendamentos: number };

export async function getTracao(): Promise<TracaoPonto[]> {
  const tid = await getTenantId();
  const sb = getCrmServer();
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - 29);
  const { data } = tid
    ? await sb
        .from("app_leads")
        .select("created_at,coluna")
        .eq("tenant_id", tid)
        .gte("created_at", desde.toISOString())
    : { data: [] as { created_at: string; coluna: ColunaId }[] };

  const series: TracaoPonto[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const doDia = (data ?? []).filter((l) => String(l.created_at).slice(0, 10) === key);
    series.push({
      dia: key,
      leads: doDia.length,
      agendamentos: doDia.filter((l) => l.coluna === "agendado" || l.coluna === "ganho").length,
    });
  }
  return series;
}

/** Eventos recentes para o feed "Pulso da Operação". */
export type PulsoEvento = {
  nome: string;
  coluna: ColunaId;
  temperatura: "quente" | "morno" | "frio";
  precisaHumano: boolean;
  origem: string;
};

export async function getPulso(): Promise<PulsoEvento[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_leads")
    .select("nome,coluna,temperatura,precisa_humano,origem")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).map((l) => ({
    nome: l.nome,
    coluna: l.coluna,
    temperatura: l.temperatura,
    precisaHumano: l.precisa_humano,
    origem: ORIGEM_LABEL[l.origem] ?? "Site",
  }));
}

/** Conversas = leads que possuem mensagens, com o histórico. */
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Minutos de inatividade do atendente antes da conversa voltar para a IA. */
const LOCK_TIMEOUT_MIN = 10;

export async function getConversas(): Promise<Conversa[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmServer();

  // Libera travas expiradas (SDR ficou inativo) antes de ler.
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MIN * 60_000).toISOString();
  await sb
    .from("app_leads")
    .update({ atendente_id: null, comando: "ia" })
    .eq("tenant_id", tid)
    .eq("comando", "humano")
    .not("atendente_id", "is", null)
    .lt("ultimo_atendente_at", cutoff);

  const [{ data, error }, { data: perfis }] = await Promise.all([
    sb
      .from("app_leads")
      .select(
        "id,nome,telefone,canal,origem,temperatura,comando,precisa_humano,diagnostico,atendente_id,app_mensagens(id,autor,texto,created_at,midia_url,midia_tipo)"
      )
      .eq("tenant_id", tid)
      .order("id"),
    sb.from("app_profiles").select("id,nome").eq("tenant_id", tid),
  ]);
  if (error) throw error;

  const nomePorId = new Map((perfis ?? []).map((p) => [p.id, p.nome as string]));

  // Gera URLs assinadas para todas as mídias de uma vez (1 chamada).
  const caminhos: string[] = [];
  (data ?? []).forEach((l) =>
    (l.app_mensagens as { midia_url: string | null }[] | null)?.forEach((m) => {
      if (m.midia_url) caminhos.push(m.midia_url);
    })
  );
  const urlPorCaminho = await urlsAssinadasMidia(caminhos);

  return (data ?? [])
    .filter((l) => (l.app_mensagens as unknown[])?.length > 0)
    .map((l) => {
      const msgs = (l.app_mensagens as {
        id: number;
        autor: "ia" | "lead" | "atendente";
        texto: string;
        created_at: string;
        midia_url: string | null;
        midia_tipo: string | null;
      }[])
        .slice()
        .sort((a, b) => a.id - b.id);
      return {
        id: l.id,
        nome: l.nome,
        telefone: l.telefone ?? "",
        canal: l.canal ?? "whatsapp",
        origem: ORIGEM_LABEL[l.origem] ?? "Site",
        temperatura: l.temperatura,
        comando: l.comando,
        precisaHumano: l.precisa_humano,
        diagnostico: l.diagnostico ?? "",
        atendenteId: l.atendente_id ?? null,
        atendenteNome: l.atendente_id ? nomePorId.get(l.atendente_id) ?? "Atendente" : "",
        mensagens: msgs.map((m) => ({
          id: m.id,
          autor: m.autor,
          texto: m.texto,
          hora: hhmm(m.created_at),
          midiaUrl: m.midia_url ? urlPorCaminho.get(m.midia_url) ?? null : null,
          midiaTipo: (m.midia_tipo as "imagem" | "audio" | "documento" | null) ?? null,
        })),
      } as Conversa;
    });
}

/** Configurações — identidade do negócio + persona do agente de IA (uma por tenant). */
export type Config = {
  nomeNegocio: string;
  endereco: string;
  email: string;
  horario: string;
  // Persona do SDR de IA (alimenta o system prompt do agente).
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
  agenteAtivo: boolean;
};

const CONFIG_VAZIO: Config = {
  nomeNegocio: "",
  endereco: "",
  email: "",
  horario: "",
  oferta: "",
  publico: "",
  tom: "",
  objecoes: "",
  faq: "",
  regras: "",
  agenteAtivo: true,
};

export async function getConfig(): Promise<Config> {
  const tid = await getTenantId();
  if (!tid) return { ...CONFIG_VAZIO };
  const sb = getCrmServer();
  const { data } = await sb.from("app_config").select("*").eq("tenant_id", tid).maybeSingle();
  const c = (data ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return {
    nomeNegocio: str("nome_negocio"),
    endereco: str("endereco"),
    email: str("email"),
    horario: str("horario"),
    oferta: str("oferta"),
    publico: str("publico"),
    tom: str("tom"),
    objecoes: str("objecoes"),
    faq: str("faq"),
    regras: str("regras"),
    agenteAtivo: c.agente_ativo === undefined ? true : Boolean(c.agente_ativo),
  };
}

/** Funil (Tela 6) — agregações por período. */
export async function getFunilDados(): Promise<Record<Periodo, DadosFunil>> {
  const tid = await getTenantId();
  const sb = getCrmServer();
  const [{ data: leads }, { data: trafego }] = tid
    ? await Promise.all([
        sb.from("app_leads").select("coluna,comando,valor,created_at").eq("tenant_id", tid),
        sb
          .from("app_trafego")
          .select("dia,fonte,cliques,investimento_cents,visitantes")
          .eq("tenant_id", tid),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const dias: Record<Periodo, number> = { hoje: 1, "7": 7, "15": 15, "30": 30 };

  function calc(p: Periodo): DadosFunil {
    const corte = new Date();
    corte.setHours(0, 0, 0, 0);
    corte.setDate(corte.getDate() - (dias[p] - 1));

    const tr = (trafego ?? []).filter((t) => new Date(t.dia) >= corte);
    const ld = (leads ?? []).filter((l) => new Date(l.created_at) >= corte);

    const somaT = (fonte: string, campo: "cliques" | "investimento_cents" | "visitantes") =>
      tr.filter((t) => (fonte ? t.fonte === fonte : true)).reduce((s, t) => s + (t[campo] ?? 0), 0);

    const metaCliques = somaT("meta_ads", "cliques");
    const googleCliques = somaT("google_ads", "cliques");
    const visitantes = somaT("", "visitantes");
    const conversas = ld.length;
    const descartados = ld.filter((l) => l.coluna === "perdido").length;
    const vendas = ld.filter((l) => l.coluna === "ganho").length;
    const agendAuto = ld.filter((l) => l.coluna === "agendado" && l.comando === "ia").length;
    const handoff = ld.filter((l) => l.comando === "humano").length;
    const faturamento = ld
      .filter((l) => l.coluna === "ganho")
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);
    const cliquesTotais = metaCliques + googleCliques;

    return {
      metaCliques,
      metaInvest: somaT("meta_ads", "investimento_cents") / 100,
      googleCliques,
      googleInvest: somaT("google_ads", "investimento_cents") / 100,
      visitantes,
      lpConv: visitantes > 0 ? Math.round((conversas / visitantes) * 100) : 0,
      conversas,
      descartados,
      agendAuto,
      handoff,
      vendas,
      faturamento,
      conversaoGlobal: cliquesTotais > 0 ? Math.round((vendas / cliquesTotais) * 1000) / 10 : 0,
    };
  }

  return { hoje: calc("hoje"), "7": calc("7"), "15": calc("15"), "30": calc("30") };
}
