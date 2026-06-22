"use server";

import { getSessao } from "@/lib/supabase/tenant";
import {
  conectarWhatsapp,
  statusWhatsapp,
  desconectarWhatsapp,
  type ConexaoResultado,
} from "@/lib/evolution/client";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Gera/atualiza o QR de conexão do WhatsApp do tenant logado. */
export async function acaoConectarWhatsapp(): Promise<ConexaoResultado> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId)
    return { ok: false, conectado: false, erro: "Sem permissão." };
  return conectarWhatsapp(s.tenantId);
}

/** Consulta o estado da conexão (polling do front). */
export async function acaoStatusWhatsapp(): Promise<ConexaoResultado> {
  const s = await getSessao();
  if (!s.tenantId) return { ok: false, conectado: false, erro: "Sem empresa ativa." };
  return statusWhatsapp(s.tenantId);
}

/** Desconecta o WhatsApp do tenant logado. */
export async function acaoDesconectarWhatsapp(): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  return desconectarWhatsapp(s.tenantId);
}
