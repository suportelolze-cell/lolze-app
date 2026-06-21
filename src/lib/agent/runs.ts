import { getCrmAdmin } from "@/lib/supabase/admin";
import type { AcaoSDR } from "./types";

/**
 * Observabilidade: registra cada execução de agente (tokens, latência, ações,
 * resposta, erro) em `app_agent_runs`. Best-effort — se a tabela ainda não
 * existir ou a gravação falhar, NUNCA derruba o atendimento.
 */
export type RegistroRun = {
  tenantId: string;
  leadId: number | null;
  agente: "sdr" | "agendador" | "suporte";
  modelo: string;
  acoes: AcaoSDR[];
  resposta: string;
  erro?: string | null;
  uso?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreation: number;
    cacheRead: number;
  };
  latenciaMs?: number;
};

export async function registrarRun(r: RegistroRun) {
  try {
    const admin = getCrmAdmin();
    await admin.from("app_agent_runs").insert({
      tenant_id: r.tenantId,
      lead_id: r.leadId,
      agente: r.agente,
      modelo: r.modelo,
      input_tokens: r.uso?.inputTokens ?? 0,
      output_tokens: r.uso?.outputTokens ?? 0,
      cache_creation_tokens: r.uso?.cacheCreation ?? 0,
      cache_read_tokens: r.uso?.cacheRead ?? 0,
      latencia_ms: r.latenciaMs ?? 0,
      acoes: r.acoes,
      resposta: r.resposta,
      erro: r.erro ?? null,
    });
  } catch {
    // logging é best-effort; falha aqui não invalida a resposta já enviada.
  }
}
