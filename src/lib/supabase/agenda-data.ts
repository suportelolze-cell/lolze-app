import { createClient } from "@supabase/supabase-js";
import type { Agendamento } from "@/lib/agenda";

/**
 * Cliente SERVER-ONLY do agendamento-estetica.
 * Usa a service_role key (SUPABASE_AGENDA_SERVICE_KEY — SEM NEXT_PUBLIC, então
 * nunca vai para o browser) para ler dados protegidos por RLS. Se a chave não
 * estiver setada, cai na anon (e o RLS retorna vazio).
 * Este arquivo só é importado por server components (app/(app)/agenda/page.tsx).
 */
const agenda = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_AGENDA_URL!,
  process.env.SUPABASE_AGENDA_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_AGENDA_KEY!,
  { auth: { persistSession: false } }
);

type ApptRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string; // aguardando_sinal | confirmado | concluido | cancelado | expirado
  customer_name: string;
  customer_whatsapp: string;
  notes: string | null;
  appointment_services: { name: string }[] | null;
};

/**
 * Lê os agendamentos reais (projeto agendamento-estetica) e mapeia para o
 * formato da grade. Posiciona pelo dia da semana (Seg–Sáb) e hora de início.
 */
export async function getAgendamentos(): Promise<Agendamento[]> {
  const { data, error } = await agenda
    .from("appointments")
    .select(
      "id,starts_at,ends_at,status,customer_name,customer_whatsapp,notes,appointment_services(name)"
    )
    .order("starts_at");
  if (error) throw error;

  return (data as ApptRow[])
    .map((a): Agendamento | null => {
      const ini = new Date(a.starts_at);
      const fim = new Date(a.ends_at);
      const dia = (ini.getDay() + 6) % 7; // 0 = Seg ... 6 = Dom
      if (dia > 5) return null; // grade mostra Seg–Sáb
      const inicio = ini.getHours();
      const duracao = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 3_600_000));
      const confirmado = a.status === "confirmado" || a.status === "concluido";
      const dataLabel = ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return {
        id: a.id,
        nome: a.customer_name,
        servico: a.appointment_services?.[0]?.name ?? a.notes ?? "Atendimento",
        origem: "Site",
        dia,
        inicio,
        duracao,
        status: confirmado ? "confirmado" : "pendente",
        porIA: false,
        telefone: a.customer_whatsapp,
        dataLabel,
        notas: a.notes ?? "",
      };
    })
    .filter((x): x is Agendamento => x !== null);
}
