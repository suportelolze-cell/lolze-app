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

/** Agendamentos do tenant ativo, mapeados para a grade da Agenda (Seg–Sáb). */
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

  return (data as Row[] | null ?? [])
    .map((a): Agendamento | null => {
      const ini = new Date(a.inicio);
      const fim = a.fim ? new Date(a.fim) : new Date(ini.getTime() + 3_600_000);
      const dia = (ini.getDay() + 6) % 7; // 0 = Seg ... 6 = Dom
      if (dia > 5) return null; // a grade mostra Seg–Sáb
      const inicio = ini.getHours();
      const duracao = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 3_600_000));
      const confirmado = a.status === "confirmado" || a.status === "concluido";
      return {
        id: String(a.id),
        nome: a.nome || "Lead",
        servico: a.servico || "Reunião",
        origem: ORIGEM_LABEL[a.origem ?? ""] ?? "Site",
        dia,
        inicio,
        duracao,
        status: confirmado ? "confirmado" : "pendente",
        porIA: a.por_ia,
        telefone: a.telefone ?? "",
        dataLabel: ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        notas: a.notas ?? "",
      };
    })
    .filter((x): x is Agendamento => x !== null);
}

/**
 * Eventos já existentes no Google Calendar do cliente (semana atual, Seg–Sáb),
 * mapeados como blocos "ocupado" na grade. [] se o Google não estiver conectado.
 */
export async function getOcupadosGoogle(): Promise<Agendamento[]> {
  const tid = await getTenantId();
  if (!tid) return [];

  const agora = new Date();
  const diaSemana = (agora.getDay() + 6) % 7; // 0 = Seg
  const seg = new Date(agora);
  seg.setHours(0, 0, 0, 0);
  seg.setDate(agora.getDate() - diaSemana);
  const fimSemana = new Date(seg);
  fimSemana.setDate(seg.getDate() + 7);

  const eventos = await listarEventosGoogle(tid, seg.toISOString(), fimSemana.toISOString());

  return eventos
    .map((e, i): Agendamento | null => {
      const ini = new Date(e.inicioISO);
      const fim = new Date(e.fimISO);
      const dia = (ini.getDay() + 6) % 7;
      if (dia > 5) return null; // grade mostra Seg–Sáb
      const inicio = ini.getHours();
      const duracao = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 3_600_000));
      return {
        id: `g-${i}`,
        nome: e.summary,
        servico: "Google Calendar",
        origem: "Site",
        dia,
        inicio,
        duracao,
        status: "confirmado",
        porIA: false,
        telefone: "",
        dataLabel: ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        notas: "Evento importado do Google Calendar.",
        externo: true,
      };
    })
    .filter((x): x is Agendamento => x !== null);
}
