import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";
import { enviarTextoIg } from "@/lib/instagram/client";
import { registrarErro } from "@/lib/observability/erros";

export type ResultadoEntrega = {
  ok: boolean;
  /** "painel" = lead sem canal externo (manual/site): mensagem fica só no painel. */
  canal?: string;
  erro?: string;
};

/** Tentativas de envio antes de marcar a mensagem como falhada. */
const TENTATIVAS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Saída: entrega a resposta ao contato no canal de origem e registra o RESULTADO
 * na própria mensagem (status pendente → enviada/falhou, tentativas, último erro).
 *
 * - WhatsApp → Evolution; Instagram → Graph API.
 * - Retenta com backoff antes de desistir; falha final vira `app_erros` (alta),
 *   que alerta o WhatsApp de operação — nunca mais falha silenciosa.
 * - Leads sem canal externo (manual/site) ficam só no painel (status null).
 */
export async function dispatchOutbound(
  tenantId: string,
  leadId: number,
  texto: string,
  mensagemId?: number
): Promise<ResultadoEntrega> {
  const admin = getCrmAdmin();

  const marcar = async (patch: Record<string, unknown>) => {
    if (!mensagemId) return;
    await admin
      .from("app_mensagens")
      .update(patch)
      .eq("id", mensagemId)
      .eq("tenant_id", tenantId);
  };

  try {
    const { data: lead } = await admin
      .from("app_leads")
      .select("canal,canal_user_id,telefone")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lead) return { ok: false, erro: "lead não encontrado" };

    const canal = lead.canal || "whatsapp";
    const destino = lead.canal_user_id || lead.telefone || "";

    // Sem canal externo (lead manual/site): a mensagem é só do painel.
    if (canal !== "whatsapp" && canal !== "instagram") return { ok: true, canal: "painel" };

    const { data: sec } = await admin
      .from("app_tenant_secrets")
      .select("evolution_instance,ig_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const configurado =
      canal === "whatsapp"
        ? Boolean(destino && temEvolutionConfig() && sec?.evolution_instance)
        : Boolean(destino && sec?.ig_access_token);
    if (!configurado) {
      const erro = `${canal}: canal não configurado ou lead sem destino`;
      await marcar({ status: "falhou", ultimo_erro: erro });
      await registrarErro({
        tenantId,
        leadId,
        contexto: `outbound.${canal}`,
        erro,
        severidade: "alta",
      });
      return { ok: false, canal, erro };
    }

    await marcar({ status: "pendente" });

    let ultimoErro = "envio recusado pelo canal";
    for (let i = 1; i <= TENTATIVAS; i++) {
      try {
        const ok =
          canal === "whatsapp"
            ? await enviarTexto(sec!.evolution_instance as string, destino, texto)
            : await enviarTextoIg(sec!.ig_access_token as string, destino, texto);
        if (ok) {
          await marcar({
            status: "enviada",
            enviada_em: new Date().toISOString(),
            tentativas: i,
            ultimo_erro: null,
          });
          return { ok: true, canal };
        }
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : String(e);
      }
      if (i < TENTATIVAS) await sleep(800 * i); // backoff simples
    }

    await marcar({ status: "falhou", tentativas: TENTATIVAS, ultimo_erro: ultimoErro });
    await registrarErro({
      tenantId,
      leadId,
      contexto: `outbound.${canal}`,
      erro: `entrega falhou após ${TENTATIVAS} tentativas: ${ultimoErro}`,
      severidade: "alta",
    });
    return { ok: false, canal, erro: ultimoErro };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await marcar({ status: "falhou", ultimo_erro: erro }).catch(() => {});
    await registrarErro({ tenantId, leadId, contexto: "outbound", erro: e, severidade: "alta" });
    return { ok: false, erro };
  }
}
