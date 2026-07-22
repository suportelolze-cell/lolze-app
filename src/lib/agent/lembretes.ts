import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { registrarErro } from "@/lib/observability/erros";

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

/** Flags anti-faltas por tenant (default: ligado). */
async function flagsAntiFaltas(
  admin: ReturnType<typeof getCrmAdmin>,
  ids: string[]
): Promise<Map<string, { c24: boolean; l2: boolean }>> {
  const m = new Map<string, { c24: boolean; l2: boolean }>();
  if (ids.length === 0) return m;
  const { data } = await admin
    .from("app_config")
    .select("tenant_id,antifaltas_24h,antifaltas_2h")
    .in("tenant_id", ids);
  for (const r of (data ?? []) as { tenant_id: string; antifaltas_24h: boolean | null; antifaltas_2h: boolean | null }[]) {
    m.set(r.tenant_id, { c24: r.antifaltas_24h ?? true, l2: r.antifaltas_2h ?? true });
  }
  return m;
}

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

  const flags24 = await flagsAntiFaltas(admin, Array.from(new Set(((lista24 ?? []) as Ag[]).map((a) => a.tenant_id))));
  let enviados24h = 0;
  for (const a of (lista24 ?? []) as Ag[]) {
    if (!a.lead_id) continue;
    if (flags24.get(a.tenant_id)?.c24 === false) continue; // confirmação 24h desligada

    const nome = (a.nome || "").split(" ")[0] || "tudo bem";
    const msg = `Oi ${nome}, passando pra confirmar nosso ${a.servico || "compromisso"} em ${quando(a.inicio)}. Tá tudo certo pra você? Se precisar reagendar, é só me avisar por aqui! 😊`;
    const entrega = await dispatchOutbound(a.tenant_id, a.lead_id, msg);
    // Só marca como enviado se a entrega deu certo — senão o lembrete some em
    // silêncio (e a confirmação anti-falta nunca acontece). Falhou → deixa
    // lembrete_24h_em null pra reintentar no próximo ciclo e registra o erro.
    if (entrega.ok) {
      await admin
        .from("app_agendamentos")
        .update({ lembrete_24h_em: agoraISO })
        .eq("id", a.id)
        .eq("tenant_id", a.tenant_id);
      enviados24h++;
    } else {
      await registrarErro({
        tenantId: a.tenant_id,
        contexto: "lembrete.24h.entrega",
        erro: entrega.erro ?? "falha na entrega",
        severidade: "media",
      });
    }
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

  const flags2 = await flagsAntiFaltas(admin, Array.from(new Set(((lista2 ?? []) as Ag[]).map((a) => a.tenant_id))));
  let enviados2h = 0;
  for (const a of (lista2 ?? []) as Ag[]) {
    if (!a.lead_id) continue;
    if (flags2.get(a.tenant_id)?.l2 === false) continue; // lembrete 2h desligado

    const nome = (a.nome || "").split(" ")[0] || "";
    const msg = `Olá ${nome}! Daqui a pouco temos nosso ${a.servico || "compromisso"} (${quando(a.inicio)}). Qualquer coisa, tô por aqui. Até já! 👋`;
    const entrega = await dispatchOutbound(a.tenant_id, a.lead_id, msg);
    if (entrega.ok) {
      await admin
        .from("app_agendamentos")
        .update({ lembrete_2h_em: agoraISO })
        .eq("id", a.id)
        .eq("tenant_id", a.tenant_id);
      enviados2h++;
    } else {
      await registrarErro({
        tenantId: a.tenant_id,
        contexto: "lembrete.2h.entrega",
        erro: entrega.erro ?? "falha na entrega",
        severidade: "media",
      });
    }
  }

  return { enviados24h, enviados2h };
}
