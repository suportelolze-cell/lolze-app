import { getCrmAdmin } from "@/lib/supabase/admin";
import { getCrmServer } from "@/lib/supabase/server";
import { getSessao } from "@/lib/supabase/tenant";
import { exigirSuperadmin } from "./data";

/**
 * Trilha de auditoria de alterações no agente/configuração (dossiê §11).
 * Best-effort deliberado: registrar auditoria NUNCA pode quebrar a ação que a
 * originou. Complementa app_persona_versoes (que guarda snapshots para
 * rollback) — aqui fica o "quem fez o quê, quando", legível.
 */

export type AcaoAuditoria =
  | "persona.editada"
  | "persona.revertida"
  | "ia.pausada"
  | "ia.reativada"
  | "cliente.criado"
  | "cliente.atualizado"
  | "cliente.excluido"
  | "acesso.email_alterado"
  | "impersonacao.iniciada"
  | "canal.configurado";

export const ROTULO_ACAO: Record<string, string> = {
  "persona.editada": "Persona do agente editada",
  "persona.revertida": "Persona do agente restaurada",
  "ia.pausada": "IA pausada",
  "ia.reativada": "IA reativada",
  "cliente.criado": "Cliente criado",
  "cliente.atualizado": "Cliente atualizado",
  "cliente.excluido": "Cliente excluído",
  "acesso.email_alterado": "E-mail de acesso alterado",
  "impersonacao.iniciada": "Entrou como cliente",
  "canal.configurado": "Canal configurado",
};

/** Registra um evento de auditoria. Best-effort — não lança. */
export async function registrarAuditoria(e: {
  acao: AcaoAuditoria;
  tenantId?: string | null;
  alvo?: string | null;
  detalhe?: Record<string, unknown>;
}): Promise<void> {
  try {
    const s = await getSessao();
    const admin = getCrmAdmin();

    let nome: string | null = null;
    if (s.userId) {
      const { data: perfil } = await admin
        .from("app_profiles")
        .select("nome")
        .eq("id", s.userId)
        .maybeSingle();
      nome = (perfil?.nome as string | null) ?? null;
    }

    // Denormaliza o nome do cliente no momento da escrita: sobrevive à exclusão
    // do tenant (que zera tenant_id) e evita join na leitura.
    let alvo = e.alvo ?? null;
    if (!alvo && e.tenantId) {
      const { data: t } = await admin
        .from("app_tenants")
        .select("nome")
        .eq("id", e.tenantId)
        .maybeSingle();
      alvo = (t?.nome as string | null) ?? null;
    }

    await admin.from("app_auditoria").insert({
      tenant_id: e.tenantId ?? null,
      ator_id: s.userId,
      ator_nome: nome,
      acao: e.acao,
      alvo,
      detalhe: e.detalhe ?? {},
    });
  } catch {
    /* auditoria é observação; nunca quebra o fluxo */
  }
}

export type LinhaAuditoria = {
  id: number;
  acao: string;
  acaoRotulo: string;
  ator: string | null;
  alvo: string | null;
  quando: string;
};

/** Lista os eventos de auditoria mais recentes. Superadmin. */
export async function listarAuditoria(limite = 100): Promise<LinhaAuditoria[]> {
  await exigirSuperadmin();
  const sb = await getCrmServer();
  const { data } = await sb
    .from("app_auditoria")
    .select("id,acao,ator_nome,alvo,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limite, 1), 300));

  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: Number(r.id),
    acao: String(r.acao),
    acaoRotulo: ROTULO_ACAO[String(r.acao)] ?? String(r.acao),
    ator: (r.ator_nome as string | null) ?? null,
    alvo: (r.alvo as string | null) ?? null,
    quando: String(r.created_at),
  }));
}
