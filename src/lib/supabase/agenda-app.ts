import { getCrmServer } from "./server";
import { getTenantId } from "./tenant";
import { ORIGEM_LABEL } from "@/lib/leads";
import type { Agendamento } from "@/lib/agenda";
import { listarEventosGoogle } from "@/lib/google/calendar";

type Row = {
  id: number;
  nome: string;
  telefone: string | null;
  servico: string;
  inicio: string;
  fim: string | null;
  status: string;
  por_ia: boolean;
  origem: string | null;
  notas: string | null;
};

const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Quebra uma data em partes no fuso de São Paulo (independe do fuso do servidor). */
function partesBRT(d: Date): { dia: number; hora: number; dataISO: string; dataLabel: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(d)) p[part.type] = part.value;
  return {
    dia: WD[p.weekday] ?? 0, // 0 = Seg ... 6 = Dom
    hora: parseInt(p.hour, 10) % 24,
    dataISO: `${p.year}-${p.month}-${p.day}`,
    dataLabel: `${p.day}/${p.month}`,
  };
}

/** Agendamentos do tenant ativo, mapeados para a grade da Agenda (fuso BRT). */
export async function getAgendamentosApp(): Promise<Agendamento[]> {
  const tid = await getTenantId();
  if (!tid) return [];
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_agendamentos")
    .select("id,nome,telefone,servico,inicio,fim,status,por_ia,origem,notas")
    .eq("tenant_id", tid)
    .neq("status", "cancelado")
    .order("inicio");

  return ((data as Row[] | null) ?? []).map((a): Agendamento => {
    const ini = new Date(a.inicio);
    const fim = a.fim ? new Date(a.fim) : new Date(ini.getTime() + 3_600_000);
    const { dia, hora, dataISO, dataLabel } = partesBRT(ini);
    const duracao = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 3_600_000));
    const confirmado = a.status === "confirmado" || a.status === "concluido";
    const bloqueio = (a.servico || "").toLowerCase() === "bloqueio";
    return {
      id: String(a.id),
      nome: bloqueio ? "🔒 Bloqueado" : a.nome || "Lead",
      servico: bloqueio ? "Indisponível" : a.servico || "Reunião",
      origem: ORIGEM_LABEL[a.origem ?? ""] ?? "Site",
      dia,
      inicio: hora,
      duracao,
      status: confirmado ? "confirmado" : "pendente",
      porIA: a.por_ia,
      telefone: a.telefone ?? "",
      dataLabel,
      notas: a.notas ?? "",
      bloqueio,
      dataISO,
    };
  });
}

/**
 * Eventos já existentes no Google Calendar do cliente, mapeados como blocos
 * "ocupado". Por padrão pega o mês visível (timeMin/timeMax) ou a semana atual.
 * [] se o Google não estiver conectado.
 */
export async function getOcupadosGoogle(timeMinISO?: string, timeMaxISO?: string): Promise<Agendamento[]> {
  const tid = await getTenantId();
  if (!tid) return [];

  let minISO = timeMinISO;
  let maxISO = timeMaxISO;
  if (!minISO || !maxISO) {
    // padrão: semana atual (Seg–Dom)
    const agora = new Date();
    const diaSemana = (agora.getDay() + 6) % 7;
    const seg = new Date(agora);
    seg.setHours(0, 0, 0, 0);
    seg.setDate(agora.getDate() - diaSemana);
    const fimSemana = new Date(seg);
    fimSemana.setDate(seg.getDate() + 7);
    minISO = seg.toISOString();
    maxISO = fimSemana.toISOString();
  }

  // Dedup: não mostrar eventos do Google que são espelho dos nossos agendamentos
  // (mesmo google_event_id OU mesmo horário de início) — evita card duplicado.
  const sb = getCrmServer();
  const { data: ags } = await sb
    .from("app_agendamentos")
    .select("inicio,google_event_id")
    .eq("tenant_id", tid)
    .neq("status", "cancelado");
  const meusIds = new Set(
    ((ags ?? []) as { google_event_id: string | null }[])
      .map((a) => a.google_event_id)
      .filter((x): x is string => Boolean(x))
  );
  const meusInicios = new Set(
    ((ags ?? []) as { inicio: string }[]).map((a) => new Date(a.inicio).getTime())
  );

  const eventos = (await listarEventosGoogle(tid, minISO, maxISO)).filter(
    (e) => !meusIds.has(e.id) && !meusInicios.has(new Date(e.inicioISO).getTime())
  );

  return eventos.map((e, i): Agendamento => {
    const ini = new Date(e.inicioISO);
    const fim = new Date(e.fimISO);
    const { dia, hora, dataISO, dataLabel } = partesBRT(ini);
    const duracao = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 3_600_000));
    return {
      id: `g-${i}`,
      nome: e.summary,
      servico: "Google Calendar",
      origem: "Site",
      dia,
      inicio: hora,
      duracao,
      status: "confirmado",
      porIA: false,
      telefone: "",
      dataLabel,
      notas: "Evento importado do Google Calendar.",
      externo: true,
      dataISO,
    };
  });
}

export type AntiFaltas = { c24: boolean; l2: boolean; resgate: boolean };

/** Configuração de lembretes anti-faltas do tenant ativo. */
export async function getAntiFaltas(): Promise<AntiFaltas> {
  const tid = await getTenantId();
  if (!tid) return { c24: true, l2: true, resgate: false };
  const sb = getCrmServer();
  const { data } = await sb
    .from("app_config")
    .select("antifaltas_24h,antifaltas_2h,antifaltas_resgate")
    .eq("tenant_id", tid)
    .maybeSingle();
  return {
    c24: data?.antifaltas_24h ?? true,
    l2: data?.antifaltas_2h ?? true,
    resgate: data?.antifaltas_resgate ?? false,
  };
}
