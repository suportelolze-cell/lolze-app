"use server";

import { getCrmServer } from "./server";
import { getSessao, getTenantId } from "./tenant";
import { getConversas } from "./crm-data";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import type { ColunaId } from "@/lib/leads";
import type { Conversa } from "@/lib/conversas";

/** Recarrega as conversas do tenant (usado pelo chat ao vivo). */
export async function recarregarConversas(): Promise<Conversa[]> {
  return getConversas();
}

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Move um card de coluna (Pipeline). */
export async function moverLead(id: number, coluna: ColunaId) {
  const tid = await getTenantId();
  const sb = getCrmServer();
  const q = sb.from("app_leads").update({ coluna }).eq("id", id);
  const { error } = await (tid ? q.eq("tenant_id", tid) : q);
  if (error) throw error;
}

export type ResAssumir = { ok: boolean; erro?: string; atendenteId?: string };

/**
 * Assume a conversa (trava para os outros). Só consegue se estiver livre (IA)
 * ou já for sua. O gestor (dono/superadmin) pode forçar a tomada.
 */
export async function assumirConversa(id: number): Promise<ResAssumir> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };
  const sb = getCrmServer();

  let q = sb
    .from("app_leads")
    .update({
      comando: "humano",
      precisa_humano: false,
      atendente_id: s.userId,
      ultimo_atendente_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);

  // SDR comum: só pega se estiver livre ou já for dele. Gestor força.
  if (!ehGestor(s.papel)) {
    q = q.or(`atendente_id.is.null,atendente_id.eq.${s.userId}`);
  }

  const { data, error } = await q.select("id");
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) {
    return { ok: false, erro: "Esta conversa já está sendo atendida por outro membro." };
  }
  return { ok: true, atendenteId: s.userId };
}

/** Devolve a conversa para a IA (libera a trava). */
export async function devolverConversa(id: number) {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) throw new Error("Sessão inválida.");
  const sb = getCrmServer();

  let q = sb
    .from("app_leads")
    .update({ comando: "ia", atendente_id: null })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);

  // SDR comum só devolve a própria; gestor devolve qualquer uma.
  if (!ehGestor(s.papel)) q = q.eq("atendente_id", s.userId);

  const { error } = await q;
  if (error) throw error;
}

export type ResEnviar = { ok: boolean; erro?: string };

/** Envia mensagem. Só quem detém a trava da conversa pode escrever. */
export async function enviarMensagem(leadId: number, texto: string): Promise<ResEnviar> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };
  const sb = getCrmServer();

  // Renova a trava e confirma que ela é minha (atomicamente).
  const { data: dono, error: errLock } = await sb
    .from("app_leads")
    .update({ ultimo_atendente_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .eq("atendente_id", s.userId)
    .select("id");
  if (errLock) return { ok: false, erro: errLock.message };
  if (!dono || dono.length === 0) {
    return { ok: false, erro: "Você não está com esta conversa. Assuma antes de responder." };
  }

  const { error } = await sb
    .from("app_mensagens")
    .insert({ lead_id: leadId, autor: "atendente", texto, tenant_id: s.tenantId });
  if (error) return { ok: false, erro: error.message };

  // Entrega ao canal via n8n (best-effort).
  await dispatchOutbound(s.tenantId, leadId, texto);
  return { ok: true };
}

/** Configurações: salvar identidade do negócio + persona do agente (do tenant ativo). */
export async function salvarConfig(c: {
  nomeNegocio: string;
  endereco: string;
  email: string;
  horario: string;
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
  agenteAtivo: boolean;
}) {
  const tid = await getTenantId();
  if (!tid) throw new Error("Sem tenant ativo.");
  const sb = getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({
      nome_negocio: c.nomeNegocio,
      endereco: c.endereco,
      email: c.email,
      horario: c.horario,
      oferta: c.oferta,
      publico: c.publico,
      tom: c.tom,
      objecoes: c.objecoes,
      faq: c.faq,
      regras: c.regras,
      agente_ativo: c.agenteAtivo,
    })
    .eq("tenant_id", tid);
  if (error) throw error;
}
