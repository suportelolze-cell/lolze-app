import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "./outbound";
import { registrarErro } from "@/lib/observability/erros";
import { MAX_REENVIOS, backoffMin, esgotou, emMinutos } from "./reenvio";

/**
 * Outbox: reenvia mensagens de saída (autor='ia') que ficaram 'falhou' — o canal
 * pode ter caído por minutos/horas. Roda no cron. Conservador:
 * - só reenvia o que JÁ falhou (não gera mensagem nova; nada de spam);
 * - espaça por backoff (proxima_tentativa); teto de MAX_REENVIOS;
 * - esgotado → status 'morta' (dead-letter) + erro alta pro operador ver na "Hoje".
 *
 * Risco residual assumido: se uma entrega deu timeout DEPOIS de o canal aceitar,
 * a mensagem fica 'falhou' e o reenvio pode duplicar. É inerente a qualquer retry;
 * mitigado pelo teto baixo de tentativas.
 */
type MsgFalhou = {
  id: number;
  tenant_id: string;
  lead_id: number | null;
  texto: string | null;
  reenvios: number | null;
};

export async function reenviarFalhados(): Promise<{ reenviadas: number; mortas: number }> {
  const admin = getCrmAdmin();
  const agoraISO = new Date().toISOString();

  const { data } = await admin
    .from("app_mensagens")
    .select("id,tenant_id,lead_id,texto,reenvios")
    .eq("status", "falhou")
    .eq("autor", "ia")
    .lt("reenvios", MAX_REENVIOS)
    .or(`proxima_tentativa.is.null,proxima_tentativa.lte.${agoraISO}`)
    .order("id", { ascending: true })
    .limit(20);

  const msgs = (data ?? []) as MsgFalhou[];
  let reenviadas = 0;
  let mortas = 0;

  for (const m of msgs) {
    if (!m.lead_id || !m.texto) continue;
    const feitos = (m.reenvios ?? 0) + 1;

    // Marca a tentativa ANTES de disparar (se der crash, não fica em loop).
    await admin
      .from("app_mensagens")
      .update({ reenvios: feitos })
      .eq("id", m.id)
      .eq("tenant_id", m.tenant_id);

    const r = await dispatchOutbound(m.tenant_id, m.lead_id, m.texto, m.id);

    if (r.ok) {
      // dispatchOutbound já marcou 'enviada'; limpa o agendamento de reenvio.
      await admin
        .from("app_mensagens")
        .update({ proxima_tentativa: null })
        .eq("id", m.id)
        .eq("tenant_id", m.tenant_id);
      reenviadas++;
    } else if (esgotou(feitos)) {
      // Dead-letter: não entregou após todos os reenvios.
      await admin
        .from("app_mensagens")
        .update({ status: "morta", proxima_tentativa: null })
        .eq("id", m.id)
        .eq("tenant_id", m.tenant_id);
      await registrarErro({
        tenantId: m.tenant_id,
        leadId: m.lead_id,
        contexto: "outbound.dead_letter",
        erro: `mensagem não entregue após ${MAX_REENVIOS} reenvios (dead-letter)`,
        severidade: "alta",
      });
      mortas++;
    } else {
      // dispatchOutbound remarcou 'falhou'; agenda o próximo reenvio com backoff.
      await admin
        .from("app_mensagens")
        .update({ proxima_tentativa: emMinutos(backoffMin(feitos)) })
        .eq("id", m.id)
        .eq("tenant_id", m.tenant_id);
    }
  }

  return { reenviadas, mortas };
}
