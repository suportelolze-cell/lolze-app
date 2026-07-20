"use server";

import { revalidatePath } from "next/cache";
import { getTenantId } from "./tenant";
import { getCrmAdmin } from "./admin";
import { criarEventoGoogle, horarioOcupadoGoogle } from "@/lib/google/calendar";

type Resultado = { ok: boolean; erro?: string };

/** Monta o início (BRT) a partir de "YYYY-MM-DD" + "HH:MM" e o fim pela duração. */
function intervalo(data: string, hora: string, duracaoMin?: number) {
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  const dur = Number(duracaoMin) > 0 ? Number(duracaoMin) : 60;
  const fim = new Date(inicio.getTime() + dur * 60000);
  return { inicio, fim };
}

/** Há conflito (app ou Google) no intervalo? Retorna msg de erro ou null. */
async function conflito(
  admin: ReturnType<typeof getCrmAdmin>,
  tid: string,
  inicio: Date,
  fim: Date
): Promise<string | null> {
  const { data: choque } = await admin
    .from("app_agendamentos")
    .select("id")
    .eq("tenant_id", tid)
    .neq("status", "cancelado")
    .lt("inicio", fim.toISOString())
    .gt("fim", inicio.toISOString())
    .limit(1);
  if (choque && choque.length > 0) return "Já existe um compromisso nesse horário.";
  if (await horarioOcupadoGoogle(tid, inicio.toISOString(), fim.toISOString()))
    return "Esse horário está ocupado no Google Calendar.";
  return null;
}

/** Cria um agendamento manual (painel) — grava no banco e no Google. */
export async function criarAgendamentoManual(input: {
  nome: string;
  telefone?: string;
  servico?: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracaoMin?: number;
}): Promise<Resultado> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sessão inválida." };

  const { inicio, fim } = intervalo(input.data, input.hora, input.duracaoMin);
  if (isNaN(inicio.getTime())) return { ok: false, erro: "Data/hora inválida." };

  const admin = getCrmAdmin();
  const erro = await conflito(admin, tid, inicio, fim);
  if (erro) return { ok: false, erro };

  const nome = (input.nome || "Cliente").trim();
  const servico = (input.servico || "Reunião").trim();
  const { data: novo, error } = await admin
    .from("app_agendamentos")
    .insert({
      tenant_id: tid,
      nome,
      telefone: input.telefone?.trim() || null,
      servico,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      status: "confirmado",
      por_ia: false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message };

  const ev = await criarEventoGoogle(tid, {
    summary: `${servico} — ${nome}`,
    descricao: "Agendado manualmente no Lolze.",
    inicioISO: inicio.toISOString(),
    fimISO: fim.toISOString(),
  });
  if (ev && novo?.id) await admin.from("app_agendamentos").update({ google_event_id: ev }).eq("id", novo.id);

  revalidatePath("/agenda");
  return { ok: true };
}

/** Bloqueia um horário (indisponível) — grava como "Bloqueio" e cria evento no Google. */
export async function bloquearHorario(input: {
  data: string;
  hora: string;
  duracaoMin?: number;
  motivo?: string;
}): Promise<Resultado> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sessão inválida." };

  const { inicio, fim } = intervalo(input.data, input.hora, input.duracaoMin);
  if (isNaN(inicio.getTime())) return { ok: false, erro: "Data/hora inválida." };

  const admin = getCrmAdmin();
  const erro = await conflito(admin, tid, inicio, fim);
  if (erro) return { ok: false, erro };

  const motivo = input.motivo?.trim() || "";
  const { data: novo, error } = await admin
    .from("app_agendamentos")
    .insert({
      tenant_id: tid,
      nome: motivo || "Bloqueado",
      servico: "Bloqueio",
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      status: "confirmado",
      por_ia: false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message };

  const ev = await criarEventoGoogle(tid, {
    summary: `🔒 Bloqueado${motivo ? ` — ${motivo}` : ""}`,
    descricao: "Horário bloqueado no Lolze.",
    inicioISO: inicio.toISOString(),
    fimISO: fim.toISOString(),
  });
  if (ev && novo?.id) await admin.from("app_agendamentos").update({ google_event_id: ev }).eq("id", novo.id);

  revalidatePath("/agenda");
  return { ok: true };
}

/**
 * Bloqueia um horário fixo em vários dias de uma vez (recorrente).
 * Ex.: bloquear 12:00–13:00 toda Seg/Qua/Sex pelas próximas N semanas.
 */
export async function bloquearHorarioEmMassa(input: {
  diasSemana: number[]; // 0=Seg ... 6=Dom
  hora: string;
  duracaoMin?: number;
  motivo?: string;
  semanas?: number;
}): Promise<{ ok: boolean; erro?: string; criados?: number }> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sessão inválida." };
  const dias = Array.from(new Set(input.diasSemana.filter((d) => d >= 0 && d <= 6)));
  if (dias.length === 0) return { ok: false, erro: "Selecione ao menos um dia da semana." };
  const semanas = Math.min(Math.max(Number(input.semanas) || 4, 1), 52);

  // Base = hoje no fuso BR.
  const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [y, m, d] = hojeISO.split("-").map(Number);
  const hoje = new Date(Date.UTC(y, m - 1, d, 12));
  const dowHoje = (hoje.getUTCDay() + 6) % 7; // 0=Seg
  const motivo = input.motivo?.trim() || "";
  const dur = Number(input.duracaoMin) > 0 ? Number(input.duracaoMin) : 60;

  type Bloco = { inicioISO: string; fimISO: string };
  const blocos: Bloco[] = [];
  for (let w = 0; w < semanas; w++) {
    for (const dd of dias) {
      const offset = dd - dowHoje + w * 7;
      if (offset < 0) continue; // não bloqueia dias passados
      const dia = new Date(hoje);
      dia.setUTCDate(hoje.getUTCDate() + offset);
      const diaISO = dia.toISOString().slice(0, 10);
      const inicio = new Date(`${diaISO}T${input.hora}:00-03:00`);
      if (isNaN(inicio.getTime())) continue;
      const fim = new Date(inicio.getTime() + dur * 60000);
      blocos.push({ inicioISO: inicio.toISOString(), fimISO: fim.toISOString() });
    }
  }
  if (blocos.length === 0) return { ok: false, erro: "Nenhuma data válida (verifique os dias)." };

  const admin = getCrmAdmin();
  const { error } = await admin.from("app_agendamentos").insert(
    blocos.map((b) => ({
      tenant_id: tid,
      nome: motivo || "Bloqueado",
      servico: "Bloqueio",
      inicio: b.inicioISO,
      fim: b.fimISO,
      status: "confirmado",
      por_ia: false,
    }))
  );
  if (error) return { ok: false, erro: error.message };

  // Espelha no Google (best-effort; pula se não conectado). Limita a 40 eventos
  // para não estourar o tempo em bloqueios muito longos — o bloqueio no app já
  // impede a IA de marcar nesses horários de qualquer forma.
  for (const b of blocos.slice(0, 40)) {
    await criarEventoGoogle(tid, {
      summary: `🔒 Bloqueado${motivo ? ` — ${motivo}` : ""}`,
      descricao: "Bloqueio recorrente (Lolze).",
      inicioISO: b.inicioISO,
      fimISO: b.fimISO,
    }).catch(() => null);
  }

  revalidatePath("/agenda");
  return { ok: true, criados: blocos.length };
}

/** Cancela um agendamento (some da agenda). */
export async function cancelarAgendamento(id: number): Promise<Resultado> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sessão inválida." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_agendamentos")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("tenant_id", tid);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/agenda");
  return { ok: true };
}

/** Salva os toggles Anti-Faltas do tenant ativo. Só gestor (é configuração). */
export async function salvarAntiFaltas(p: {
  c24: boolean;
  l2: boolean;
  resgate: boolean;
}): Promise<Resultado> {
  const { getSessao } = await import("./tenant");
  const s = await getSessao();
  if (s.papel !== "owner" && s.papel !== "superadmin")
    return { ok: false, erro: "Sem permissão." };
  const tid = s.tenantId;
  if (!tid) return { ok: false, erro: "Sessão inválida." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({
      antifaltas_24h: p.c24,
      antifaltas_2h: p.l2,
      antifaltas_resgate: p.resgate,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
