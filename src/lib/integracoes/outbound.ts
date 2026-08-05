import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, enviarMidia, temEvolutionConfig } from "@/lib/evolution/client";
import { enviarTextoIg } from "@/lib/instagram/client";
import { credenciaisWaCloud, enviarTextoWaCloud, enviarMidiaWaCloud } from "@/lib/whatsapp/cloud";
import { registrarErro } from "@/lib/observability/erros";

export type ResultadoEntrega = {
  ok: boolean;
  /** "painel" = lead sem canal externo (manual/site): mensagem fica só no painel. */
  canal?: string;
  erro?: string;
};

/** Mídia a enviar junto (URL já assinada/pública que o canal vai buscar). */
export type MidiaSaida = {
  url: string;
  tipo: "image" | "video" | "audio" | "document";
  mime?: string;
  filename?: string;
};

/** Tentativas de envio antes de marcar a mensagem como falhada. */
const TENTATIVAS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envia um texto avulso para um número ARBITRÁRIO pelo canal WhatsApp do tenant
 * (não é uma mensagem de lead — não grava em app_mensagens). Prefere a Cloud API;
 * cai para a Evolution. Best-effort: nunca lança; devolve se entregou.
 *
 * Uso: avisos operacionais ao prestador (heads-up de agendamento). Ressalva: via
 * Cloud API, uma mensagem livre fora da janela de 24h pode ser recusada (exige
 * template) — nesse caso cai para a Evolution se o tenant tiver; senão devolve
 * false e o chamador registra (baixa).
 */
export async function notificarNumero(
  tenantId: string,
  numero: string,
  texto: string
): Promise<boolean> {
  if (!numero || !texto) return false;
  try {
    const waCloud = await credenciaisWaCloud(tenantId);
    if (waCloud) {
      const r = await enviarTextoWaCloud(waCloud, numero, texto);
      if (r.ok) return true;
    }
    const admin = getCrmAdmin();
    const { data: sec } = await admin
      .from("app_tenant_secrets")
      .select("evolution_instance")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const inst = (sec?.evolution_instance as string | null) ?? "";
    if (inst && temEvolutionConfig()) return await enviarTexto(inst, numero, texto);
    return false;
  } catch {
    return false;
  }
}

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
  mensagemId?: number,
  midia?: MidiaSaida
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

    // Instagram ainda não envia mídia pelo painel — falha CLARA e imediata, sem
    // postar texto vazio nem gastar as 3 tentativas (não é falha de infra).
    if (midia && canal === "instagram") {
      const erro = "Instagram ainda não envia mídia pelo painel (envie por texto).";
      await marcar({ status: "falhou", ultimo_erro: erro });
      return { ok: false, canal, erro };
    }

    const { data: sec } = await admin
      .from("app_tenant_secrets")
      .select("evolution_instance,ig_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // WhatsApp: prefere a API OFICIAL (Cloud API) quando o tenant tem
    // credenciais; sem elas, cai para a Evolution (migração gradual por cliente).
    const waCloud = canal === "whatsapp" ? await credenciaisWaCloud(tenantId) : null;

    const configurado =
      canal === "whatsapp"
        ? Boolean(destino && (waCloud || (temEvolutionConfig() && sec?.evolution_instance)))
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
        if (waCloud) {
          // API oficial: o wamid devolvido casa com os recibos do webhook
          // (sent/delivered/read), que evoluem o status para entregue/lida.
          const r = midia
            ? await enviarMidiaWaCloud(waCloud, destino, midia.tipo, midia.url, texto || undefined, midia.filename)
            : await enviarTextoWaCloud(waCloud, destino, texto);
          if (r.ok) {
            await marcar({
              status: "enviada",
              enviada_em: new Date().toISOString(),
              tentativas: i,
              ultimo_erro: null,
              external_message_id: r.wamid,
            });
            return { ok: true, canal };
          }
          if (r.erro) ultimoErro = r.erro;
        } else {
          let ok = false;
          if (canal === "whatsapp") {
            const inst = sec!.evolution_instance as string;
            ok = midia
              ? await enviarMidia(inst, destino, {
                  tipo: midia.tipo,
                  url: midia.url,
                  mime: midia.mime,
                  caption: texto || undefined,
                  fileName: midia.filename,
                })
              : await enviarTexto(inst, destino, texto);
          } else {
            // Instagram: envio de mídia não implementado — manda a legenda.
            ok = await enviarTextoIg(sec!.ig_access_token as string, destino, texto);
          }
          if (ok) {
            await marcar({
              status: "enviada",
              enviada_em: new Date().toISOString(),
              tentativas: i,
              ultimo_erro: null,
            });
            return { ok: true, canal };
          }
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
