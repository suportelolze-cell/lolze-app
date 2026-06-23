import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";

/**
 * Lembretes de reunião (anti no-show). Roda no cron.
 * - 24h antes: confirmação ("tá tudo certo? pode reagendar").
 * - 2h antes: toque final amigável.
 * A confirmação imediata (no ato do agendamento) já é dada pelo SDR.
 * Marca lembrete_24h_em / lembrete_2h_em para não repetir.
 */

function quando(inicioISO: string) {
  return new Date(inicioISO).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Ag = { id: number; tenant_id: string; lead_id: number | null; nome: string | null; servico: string | null; inicio: string };

export async function processarLembretes(): Promise<{ enviados24h: number; enviados2h: number }> {
  const admin = getCrmAdmin();
  const agora = new Date();
  const em2h = new Date(agora.getTime() + 2 * 3600_000).toISOString();
  const em24h = new Date(agora.getTime() + 24 * 3600_000).toISOString();
  const agoraISO = agora.toISOString();

  // 24h antes: reunião entre +2h e +24h, ainda sem lembrete de 24h.
  const { data: lista24 } = await admin
    .from("app_agendamentos")
    .select("id,tenant_id,lead_id,nome,servico,inicio")
    .neq("status", "cancelado")
    .is("lembrete_24h_em", null)
    .gt("inicio", em2h)
    .lte("inicio", em24h)
    .limit(50);

  let enviados24h = 0;
  for (const a of (lista24 ?? []) as Ag[]) {
    if (!a.lead_id) continue;
    const nome = (a.nome || "").split(" ")[0] || "tudo bem";
    const msg = `Oi ${nome}, passando pra confirmar nosso ${a.servico || "compromisso"} em ${quando(a.inicio)}. Tá tudo certo pra você? Se precisar reagendar, é só me avisar por aqui! 😊`;
    await dispatchOutbound(a.tenant_id, a.lead_id, msg);
    await admin.from("app_agendamentos").update({ lembrete_24h_em: agoraISO }).eq("id", a.id);
    enviados24h++;
  }

  // 2h antes: reunião entre agora e +2h, ainda sem lembrete de 2h.
  const { data: lista2 } = await admin
    .from("app_agendamentos")
    .select("id,tenant_id,lead_id,nome,servico,inicio")
    .neq("status", "cancelado")
    .is("lembrete_2h_em", null)
    .gt("inicio", agoraISO)
    .lte("inicio", em2h)
    .limit(50);

  let enviados2h = 0;
  for (const a of (lista2 ?? []) as Ag[]) {
    if (!a.lead_id) continue;
    const nome = (a.nome || "").split(" ")[0] || "";
    const msg = `Olá ${nome}! Daqui a pouco temos nosso ${a.servico || "compromisso"} (${quando(a.inicio)}). Qualquer coisa, tô por aqui. Até já! 👋`;
    await dispatchOutbound(a.tenant_id, a.lead_id, msg);
    await admin.from("app_agendamentos").update({ lembrete_2h_em: agoraISO }).eq("id", a.id);
    enviados2h++;
  }

  return { enviados24h, enviados2h };
}
