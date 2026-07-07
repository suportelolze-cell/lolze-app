"use server";

import { revalidatePath } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";

const ehGestor = (p: string) => p === "owner" || p === "superadmin";

/** Passo 1: identidade do negócio (a IA usa nas conversas). */
export async function salvarIdentidade(input: {
  nomeNegocio: string;
  endereco: string;
  horario: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({
      nome_negocio: input.nomeNegocio.trim(),
      endereco: input.endereco.trim(),
      horario: input.horario.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** Passo 2: persona da IA (oferta, tom, regras...). */
export async function salvarPersonaOnboarding(input: {
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({
      oferta: input.oferta,
      publico: input.publico,
      tom: input.tom,
      objecoes: input.objecoes,
      faq: input.faq,
      regras: input.regras,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** Conclui o onboarding e LIGA a IA. */
export async function concluirOnboarding(): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({ onboarding_ok: true, agente_ativo: true, updated_at: new Date().toISOString() })
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/painel");
  return { ok: true };
}
