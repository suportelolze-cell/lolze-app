import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";
import { getRecorrencia } from "@/lib/supabase/crm-data";

/**
 * Dados da tela "Hoje" (dossiê, seção 9): a tela inicial orienta O QUE FAZER,
 * não só mostra gráficos. Agrega o que precisa de ação agora — falhas de
 * entrega, handoff pendente, leads quentes sem resposta, agenda das próximas
 * 24h, clientes prontos para reativar — e a saúde dos canais/agente.
 *
 * Usa service_role com filtro explícito de tenant porque parte das fontes
 * (app_erros, app_uso_ia) é de bastidor (RLS sem policy para authenticated).
 */

export type AcaoLead = {
  leadId: number;
  nome: string;
  valor: number | null;
  detalhe: string;
  horasParado: number;
};

export type FalhaEntrega = {
  leadId: number;
  nome: string;
  texto: string;
  quandoISO: string;
};

export type CompromissoHoje = {
  id: number;
  nome: string;
  servico: string;
  inicioISO: string;
  lembreteEnviado: boolean;
};

export type ReativarHoje = {
  leadId: number;
  nome: string;
  diasDesdeUltimo: number | null;
};

export type SaudeTenant = {
  agenteAtivo: boolean;
  whatsappConectado: boolean;
  whatsappOficial: boolean; // Cloud API configurada (senão QR/Evolution)
  instagramConfigurado: boolean;
  googleConectado: boolean;
  errosAltos24h: number;
  chamadasIAHoje: number;
};

export type DadosHoje = {
  valorEmAcao: number; // soma dos valores dos leads que precisam de ação
  falhas: FalhaEntrega[];
  handoffPendente: AcaoLead[];
  quentesSemResposta: AcaoLead[];
  agenda24h: CompromissoHoje[];
  reativar: ReativarHoje[];
  saude: SaudeTenant;
};

const VAZIO: DadosHoje = {
  valorEmAcao: 0,
  falhas: [],
  handoffPendente: [],
  quentesSemResposta: [],
  agenda24h: [],
  reativar: [],
  saude: {
    agenteAtivo: true,
    whatsappConectado: false,
    whatsappOficial: false,
    instagramConfigurado: false,
    googleConectado: false,
    errosAltos24h: 0,
    chamadasIAHoje: 0,
  },
};

const H = 3_600_000;

export async function getHoje(): Promise<DadosHoje> {
  const tid = await getTenantId();
  if (!tid) return VAZIO;
  const admin = getCrmAdmin();

  const agora = Date.now();
  const iso24hAtras = new Date(agora - 24 * H).toISOString();
  const iso48hAtras = new Date(agora - 48 * H).toISOString();
  const iso24hFrente = new Date(agora + 24 * H).toISOString();
  const hojeYMD = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );

  const [
    { data: leadsAbertos },
    { data: falhasRows },
    { data: ags },
    { data: cfg },
    { data: sec },
    { count: errosAltos },
    { data: uso },
    recorrencia,
  ] = await Promise.all([
    admin
      .from("app_leads")
      .select("id,nome,temperatura,coluna,valor,precisa_humano,atendente_id")
      .eq("tenant_id", tid)
      .not("coluna", "in", "(ganho,perdido)"),
    admin
      .from("app_mensagens")
      .select("lead_id,texto,created_at")
      .eq("tenant_id", tid)
      .eq("status", "falhou")
      .gte("created_at", iso48hAtras)
      .order("id", { ascending: false })
      .limit(20),
    admin
      .from("app_agendamentos")
      .select("id,nome,servico,inicio,lembrete_24h_em,status")
      .eq("tenant_id", tid)
      .neq("status", "cancelado")
      .gte("inicio", new Date(agora).toISOString())
      .lte("inicio", iso24hFrente)
      .order("inicio"),
    admin
      .from("app_config")
      .select("agente_ativo,whatsapp_conectado,google_conectado")
      .eq("tenant_id", tid)
      .maybeSingle(),
    admin
      .from("app_tenant_secrets")
      .select("wa_phone_number_id,wa_access_token,ig_account_id,evolution_instance")
      .eq("tenant_id", tid)
      .maybeSingle(),
    admin
      .from("app_erros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("severidade", "alta")
      .gte("created_at", iso24hAtras),
    admin.from("app_uso_ia").select("chamadas").eq("tenant_id", tid).eq("dia", hojeYMD).maybeSingle(),
    getRecorrencia().catch(() => ({ clientes: [], totalBase: 0, emChurn: 0, servicosMes: 0 })),
  ]);

  type L = {
    id: number;
    nome: string;
    temperatura: string;
    coluna: string;
    valor: number | null;
    precisa_humano: boolean;
    atendente_id: string | null;
  };
  const abertos = (leadsAbertos ?? []) as L[];
  const idsAbertos = abertos.map((l) => l.id);

  // Última mensagem por lead (para saber quem está esperando resposta).
  const ultimaPorLead = new Map<number, { autor: string; created_at: string }>();
  if (idsAbertos.length > 0) {
    const { data: msgs } = await admin
      .from("app_mensagens")
      .select("lead_id,autor,created_at,id")
      .eq("tenant_id", tid)
      .in("lead_id", idsAbertos)
      .order("id", { ascending: false });
    for (const m of (msgs ?? []) as { lead_id: number; autor: string; created_at: string }[]) {
      if (!ultimaPorLead.has(m.lead_id)) ultimaPorLead.set(m.lead_id, m);
    }
  }

  const nomePorLead = new Map(abertos.map((l) => [l.id, l.nome]));
  const horas = (iso: string) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / H));

  // 1) Handoff pendente: a IA escalou e ninguém assumiu ainda.
  const handoffPendente: AcaoLead[] = abertos
    .filter((l) => l.precisa_humano && !l.atendente_id)
    .map((l) => {
      const ult = ultimaPorLead.get(l.id);
      return {
        leadId: l.id,
        nome: l.nome,
        valor: l.valor,
        detalhe: "A IA pediu ajuda humana — assuma a conversa",
        horasParado: ult ? horas(ult.created_at) : 0,
      };
    })
    .sort((a, b) => b.horasParado - a.horasParado);

  // 2) Leads quentes esperando resposta (última mensagem é do lead).
  const emHandoff = new Set(handoffPendente.map((h) => h.leadId));
  const quentesSemResposta: AcaoLead[] = abertos
    .filter((l) => {
      if (emHandoff.has(l.id)) return false;
      if (l.temperatura !== "quente" && l.coluna !== "atencao") return false;
      const ult = ultimaPorLead.get(l.id);
      return Boolean(ult && ult.autor === "lead");
    })
    .map((l) => {
      const ult = ultimaPorLead.get(l.id)!;
      return {
        leadId: l.id,
        nome: l.nome,
        valor: l.valor,
        detalhe: "Lead quente aguardando resposta",
        horasParado: horas(ult.created_at),
      };
    })
    .sort((a, b) => b.horasParado - a.horasParado)
    .slice(0, 10);

  // 3) Valor em jogo nas oportunidades que precisam de ação.
  const idsAcao = new Set([...handoffPendente, ...quentesSemResposta].map((a) => a.leadId));
  const valorEmAcao = abertos
    .filter((l) => idsAcao.has(l.id))
    .reduce((s, l) => s + (Number(l.valor) || 0), 0);

  // 4) Mensagens que falharam (48h) — a venda que quase se perdeu em silêncio.
  const falhas: FalhaEntrega[] = ((falhasRows ?? []) as {
    lead_id: number;
    texto: string;
    created_at: string;
  }[]).map((f) => ({
    leadId: f.lead_id,
    nome: nomePorLead.get(f.lead_id) ?? `Lead ${f.lead_id}`,
    texto: f.texto.length > 80 ? f.texto.slice(0, 80) + "…" : f.texto,
    quandoISO: f.created_at,
  }));

  // 5) Agenda das próximas 24h (e se o lembrete anti-falta já saiu).
  const agenda24h: CompromissoHoje[] = ((ags ?? []) as {
    id: number;
    nome: string;
    servico: string;
    inicio: string;
    lembrete_24h_em: string | null;
  }[]).map((a) => ({
    id: a.id,
    nome: a.nome,
    servico: a.servico,
    inicioISO: a.inicio,
    lembreteEnviado: Boolean(a.lembrete_24h_em),
  }));

  // 6) Clientes da base prontos para reativar (churn da Recorrência).
  const reativar: ReativarHoje[] = recorrencia.clientes
    .filter((c) => c.churn)
    .slice(0, 5)
    .map((c) => ({ leadId: c.leadId, nome: c.nome, diasDesdeUltimo: c.diasDesdeUltimo }));

  const saude: SaudeTenant = {
    agenteAtivo: Boolean(cfg?.agente_ativo ?? true),
    whatsappConectado:
      Boolean(cfg?.whatsapp_conectado) || Boolean(sec?.wa_phone_number_id && sec?.wa_access_token),
    whatsappOficial: Boolean(sec?.wa_phone_number_id && sec?.wa_access_token),
    instagramConfigurado: Boolean(sec?.ig_account_id),
    googleConectado: Boolean(cfg?.google_conectado),
    errosAltos24h: errosAltos ?? 0,
    chamadasIAHoje: Number(uso?.chamadas ?? 0),
  };

  return { valorEmAcao, falhas, handoffPendente, quentesSemResposta, agenda24h, reativar, saude };
}
