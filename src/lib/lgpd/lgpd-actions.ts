"use server";

import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { registrarAuditoria } from "@/lib/admin/auditoria";
import { excluirEventoGoogle } from "@/lib/google/calendar";
import {
  PII_LEAD_PATCH,
  AGENDAMENTO_ANON_PATCH,
  anonimizarDadosEvento,
  TABELAS_DUMP_TENANT,
  montarExportLead,
  montarDumpTenant,
} from "./lgpd-core";

type Admin = ReturnType<typeof getCrmAdmin>;

/** Gestor da conta = dono (owner) ou superadmin (impersonando). */
const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Carrega o lead confirmando que pertence ao tenant EFETIVO da sessão. */
async function leadDoTenant(admin: Admin, leadId: number, tenantId: string) {
  const { data } = await admin
    .from("app_leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}

/** Remove do Storage as mídias referenciadas pelas mensagens do lead. */
async function removerMidiasDoLead(admin: Admin, leadId: number) {
  const { data } = await admin
    .from("app_mensagens")
    .select("midia_url")
    .eq("lead_id", leadId)
    .not("midia_url", "is", null);
  const paths = (data ?? []).map((m) => m.midia_url as string).filter(Boolean);
  if (paths.length) await admin.storage.from("midias").remove(paths);
}

/** Cancela no Google Calendar os eventos dos agendamentos do lead (best-effort). */
async function cancelarEventosGoogle(admin: Admin, leadId: number, tenantId: string) {
  const { data } = await admin
    .from("app_agendamentos")
    .select("google_event_id")
    .eq("lead_id", leadId)
    .not("google_event_id", "is", null);
  for (const a of data ?? []) {
    await excluirEventoGoogle(tenantId, a.google_event_id as string);
  }
}

/**
 * A1 — Exporta TODOS os dados de UM titular (lead) em JSON de portabilidade.
 * Gate: gestor da conta. Nada é persistido no servidor; o browser baixa.
 */
export async function exportarDadosLead(
  leadId: number
): Promise<{ ok: boolean; json?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const tid = s.tenantId;
  const admin = getCrmAdmin();

  const lead = await leadDoTenant(admin, leadId, tid);
  if (!lead) return { ok: false, erro: "Contato não encontrado." };

  const [mensagens, agendamentos, canais, eventos, runs, erros] = await Promise.all([
    admin.from("app_mensagens").select("*").eq("lead_id", leadId),
    admin.from("app_agendamentos").select("*").eq("lead_id", leadId),
    admin.from("app_lead_canais").select("*").eq("lead_id", leadId),
    admin.from("app_eventos").select("*").eq("lead_id", leadId),
    admin.from("app_agent_runs").select("*").eq("lead_id", leadId),
    admin.from("app_erros").select("*").eq("lead_id", leadId),
  ]);

  const pkg = montarExportLead({
    geradoEm: new Date().toISOString(),
    tenantId: tid,
    leadId,
    lead,
    mensagens: mensagens.data ?? [],
    agendamentos: agendamentos.data ?? [],
    lead_canais: canais.data ?? [],
    eventos: eventos.data ?? [],
    agent_runs: runs.data ?? [],
    erros: erros.data ?? [],
  });

  await registrarAuditoria({
    acao: "lead.exportado",
    tenantId: tid,
    alvo: `contato #${leadId}`,
    detalhe: { leadId },
  });

  return { ok: true, json: JSON.stringify(pkg, null, 2) };
}

/**
 * A2 — Atende o direito de eliminação de UM titular.
 * - "anonimizar" (padrão): remove PID (mensagens, canais, logs, PII do lead e
 *   dos agendamentos) mas PRESERVA o ledger financeiro (app_eventos.valor_cents).
 * - "excluir": hard-delete do lead (CASCADE também apaga os eventos → perde o ROI).
 * Efeitos fora do Postgres (Storage, Google Calendar) tratados primeiro.
 * Filtra os filhos por lead_id (bigint identity GLOBAL) — pega inclusive órfãos
 * com tenant_id NULL (app_erros/app_agent_runs não têm FK ao lead).
 */
export async function excluirDadosLead(
  leadId: number,
  modo: "anonimizar" | "excluir"
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const tid = s.tenantId;
  const admin = getCrmAdmin();

  const lead = await leadDoTenant(admin, leadId, tid);
  if (!lead) return { ok: false, erro: "Contato não encontrado." };

  // Efeitos externos primeiro (best-effort; não bloqueiam a purga no banco).
  await removerMidiasDoLead(admin, leadId); // Storage 'midias'
  await cancelarEventosGoogle(admin, leadId, tid); // Google Calendar

  const passos =
    modo === "excluir"
      ? [
          () => admin.from("app_agendamentos").delete().eq("lead_id", leadId),
          () => admin.from("app_agent_runs").delete().eq("lead_id", leadId),
          () => admin.from("app_erros").delete().eq("lead_id", leadId),
          // CASCADE apaga mensagens/eventos/lead_canais ao remover o lead:
          () => admin.from("app_leads").delete().eq("id", leadId).eq("tenant_id", tid),
        ]
      : [
          () => admin.from("app_mensagens").delete().eq("lead_id", leadId),
          () => admin.from("app_lead_canais").delete().eq("lead_id", leadId),
          () => admin.from("app_agent_runs").delete().eq("lead_id", leadId),
          () => admin.from("app_erros").delete().eq("lead_id", leadId),
          () => admin.from("app_agendamentos").update(AGENDAMENTO_ANON_PATCH).eq("lead_id", leadId),
          () => admin.from("app_leads").update(PII_LEAD_PATCH).eq("id", leadId).eq("tenant_id", tid),
        ];

  for (const passo of passos) {
    const { error } = await passo();
    if (error) return { ok: false, erro: error.message };
  }

  // Anonimizar o jsonb livre de cada evento preservado (allowlist).
  if (modo === "anonimizar") {
    const { data: evs } = await admin.from("app_eventos").select("id,dados").eq("lead_id", leadId);
    for (const ev of evs ?? []) {
      const limpo = anonimizarDadosEvento(ev.dados as Record<string, unknown>);
      const { error } = await admin.from("app_eventos").update({ dados: limpo }).eq("id", ev.id);
      if (error) return { ok: false, erro: error.message };
    }
  }

  // Auditoria com alvo NÃO-PII: gravar o nome real aqui re-identificaria o
  // titular para sempre no log (que é imutável) — anulando a anonimização.
  await registrarAuditoria({
    acao: modo === "excluir" ? "lead.excluido" : "lead.anonimizado",
    tenantId: tid,
    alvo: `contato #${leadId}`,
    detalhe: { leadId, modo },
  });

  return { ok: true };
}

/**
 * B1 — Exporta o dump COMPLETO de uma conta (para portabilidade/backup antes de
 * excluir). Gate: superadmin. NUNCA inclui segredos (app_tenant_secrets).
 */
export async function exportarContaTenant(
  tenantId: string
): Promise<{ ok: boolean; json?: string; erro?: string }> {
  const s = await getSessao();
  if (s.papel !== "superadmin") return { ok: false, erro: "Acesso restrito." };
  const admin = getCrmAdmin();

  const tabelas: Record<string, unknown[]> = {};
  for (const tabela of TABELAS_DUMP_TENANT) {
    if (tabela === "app_ideias") {
      const { data: ideias } = await admin.from("app_ideias").select("*").eq("tenant_id", tenantId);
      tabelas["app_ideias"] = ideias ?? [];
      const ids = (ideias ?? []).map((i) => (i as { id: unknown }).id);
      if (ids.length) {
        // app_ideia_* não têm tenant_id — buscar por ideia_id.
        const [coment, likes] = await Promise.all([
          admin.from("app_ideia_comentarios").select("*").in("ideia_id", ids),
          admin.from("app_ideia_likes").select("*").in("ideia_id", ids),
        ]);
        tabelas["app_ideia_comentarios"] = coment.data ?? [];
        tabelas["app_ideia_likes"] = likes.data ?? [];
      }
      continue;
    }
    const col = tabela === "app_tenants" ? "id" : "tenant_id";
    const { data } = await admin.from(tabela).select("*").eq(col, tenantId);
    tabelas[tabela] = data ?? [];
  }

  const pkg = montarDumpTenant(new Date().toISOString(), tenantId, tabelas);
  await registrarAuditoria({ acao: "conta.exportada", tenantId, alvo: null });

  return { ok: true, json: JSON.stringify(pkg, null, 2) };
}
