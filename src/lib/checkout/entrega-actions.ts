"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { colunaAusente } from "@/lib/supabase/pg-erros";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/**
 * Lê a mensagem de entrega PADRÃO do tenant (oferta = ''). Tolerante à tabela
 * ausente (migração pendente): sinaliza migracaoPendente para a UI avisar.
 */
export async function getEntregaPadrao(): Promise<{
  ok: boolean;
  erro?: string;
  mensagem: string;
  ativo: boolean;
  migracaoPendente: boolean;
}> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId)
    return { ok: false, erro: "Sem permissão.", mensagem: "", ativo: true, migracaoPendente: false };

  const admin = getCrmAdmin();
  const { data, error } = await admin
    .from("app_entregas")
    .select("mensagem,ativo")
    .eq("tenant_id", s.tenantId)
    .eq("oferta", "")
    .maybeSingle();

  if (error) {
    if (colunaAusente(error))
      return { ok: true, mensagem: "", ativo: true, migracaoPendente: true };
    return { ok: false, erro: error.message, mensagem: "", ativo: true, migracaoPendente: false };
  }
  const r = (data as { mensagem?: string; ativo?: boolean } | null) ?? null;
  return {
    ok: true,
    mensagem: r?.mensagem ?? "",
    ativo: r?.ativo ?? true,
    migracaoPendente: false,
  };
}

/** Salva a mensagem de entrega padrão do tenant. Só gestor. */
export async function salvarEntregaPadrao(input: {
  mensagem: string;
  ativo: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const admin = getCrmAdmin();
  const { error } = await admin.from("app_entregas").upsert(
    {
      tenant_id: s.tenantId,
      oferta: "",
      mensagem: (input.mensagem ?? "").trim(),
      ativo: Boolean(input.ativo),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,oferta" }
  );

  if (error) {
    if (colunaAusente(error))
      return { ok: false, erro: "A tabela de entregas ainda não existe no banco. Aplique a migração de entrega primeiro." };
    return { ok: false, erro: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}
