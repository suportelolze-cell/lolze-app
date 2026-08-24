"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { colunaAusente } from "@/lib/supabase/pg-erros";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";
const PLAYBOOKS = ["servico_local", "infoproduto"] as const;
export type Playbook = (typeof PLAYBOOKS)[number];
const normaliza = (v: unknown): Playbook => (v === "infoproduto" ? "infoproduto" : "servico_local");

/**
 * Lê o playbook do tenant. Tolerante à coluna ausente (migração pendente):
 * nesse caso devolve o padrão e sinaliza migracaoPendente para a UI avisar.
 */
export async function getPlaybook(): Promise<{
  ok: boolean;
  erro?: string;
  playbook: Playbook;
  migracaoPendente: boolean;
}> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId)
    return { ok: false, erro: "Sem permissão.", playbook: "servico_local", migracaoPendente: false };

  const admin = getCrmAdmin();
  const { data, error } = await admin
    .from("app_config")
    .select("playbook")
    .eq("tenant_id", s.tenantId)
    .maybeSingle();

  if (error) {
    if (colunaAusente(error))
      return { ok: true, playbook: "servico_local", migracaoPendente: true };
    return { ok: false, erro: error.message, playbook: "servico_local", migracaoPendente: false };
  }
  return {
    ok: true,
    playbook: normaliza((data as { playbook?: unknown } | null)?.playbook),
    migracaoPendente: false,
  };
}

/** Salva o playbook do tenant. Só gestor. */
export async function salvarPlaybook(playbook: string): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({ playbook: normaliza(playbook) })
    .eq("tenant_id", s.tenantId);

  if (error) {
    if (colunaAusente(error))
      return { ok: false, erro: "A coluna 'playbook' ainda não existe no banco. Aplique a migração de checkout/playbook primeiro." };
    return { ok: false, erro: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}
