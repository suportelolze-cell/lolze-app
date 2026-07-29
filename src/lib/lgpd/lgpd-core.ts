/**
 * Núcleo PURO do módulo LGPD (sem `@/`, sem side-effects, sem I/O).
 * Define as regras de anonimização e monta os pacotes de exportação. Fica puro
 * de propósito para ser testável via `node --test` (importado por caminho
 * relativo em tests/). As server actions em `lgpd-actions.ts` fazem o I/O.
 */

/**
 * Campos de PII do lead a zerar na ANONIMIZAÇÃO. Mantém a "casca" (id, valor,
 * tenant_id, coluna, datas) para o ledger financeiro (app_eventos) continuar
 * válido — a pessoa deixa de ser identificável, a venda permanece.
 */
export const PII_LEAD_PATCH: Record<string, unknown> = {
  nome: "[removido]",
  telefone: null,
  email: null,
  diagnostico: null,
  ultima_msg: null,
  canal_user_id: null,
  comando: null,
  proximo_followup: null, // some da régua de follow-up
  precisa_humano: false,
};

/** Campos de PII do agendamento a zerar na anonimização (linha sobrevive). */
export const AGENDAMENTO_ANON_PATCH: Record<string, unknown> = {
  nome: "[removido]",
  telefone: null,
  servico: null,
  notas: null,
  google_event_id: null,
};

/**
 * Anonimiza o jsonb livre de `app_eventos.dados` por ALLOWLIST: mantém só
 * chaves comprovadamente não-PII. O valor financeiro vive na COLUNA
 * `valor_cents` (não neste jsonb), então esvaziar aqui não perde ROI. Allowlist
 * (não blocklist) para nunca vazar uma chave de PII desconhecida.
 */
const EVENTO_DADOS_ALLOWLIST = new Set<string>(["valor_cents", "turno"]);
export function anonimizarDadosEvento(
  dados: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!dados || typeof dados !== "object") return {};
  const limpo: Record<string, unknown> = {};
  for (const chave of Object.keys(dados)) {
    if (EVENTO_DADOS_ALLOWLIST.has(chave)) limpo[chave] = dados[chave];
  }
  return limpo;
}

/**
 * Tabelas com dado do TENANT a incluir no dump de portabilidade da conta.
 * NUNCA inclui `app_tenant_secrets` (tokens/segredos não se exportam).
 * (app_ideia_comentarios/app_ideia_likes entram por ideia_id no action, pois
 * não têm coluna tenant_id.)
 */
export const TABELAS_DUMP_TENANT = [
  "app_tenants",
  "app_config",
  "app_profiles",
  "app_leads",
  "app_mensagens",
  "app_agendamentos",
  "app_lead_canais",
  "app_eventos",
  "app_agent_runs",
  "app_erros",
  "app_kb_documents",
  "app_persona_versoes",
  "app_prospects",
  "app_trafego",
  "app_uso_ia",
  "app_ideias",
  "app_biblioteca_midia",
] as const;

/**
 * Tabelas com dado do tenant que NÃO têm FK para app_tenants — o CASCADE do
 * `delete` do tenant não as limpa, então precisam de exclusão explícita.
 */
export const ORFAOS_TENANT = ["app_erros", "app_prospects", "app_uso_ia", "app_ideias"] as const;

export type PartesExportLead = {
  geradoEm: string;
  tenantId: string;
  leadId: number;
  lead: Record<string, unknown> | null;
  mensagens: unknown[];
  agendamentos: unknown[];
  lead_canais: unknown[];
  eventos: unknown[];
  agent_runs: unknown[];
  erros: unknown[];
};

/** Monta o pacote de portabilidade (LGPD art. 18) de UM titular (lead). */
export function montarExportLead(p: PartesExportLead) {
  return {
    formato: "lgpd-portabilidade-v1",
    gerado_em: p.geradoEm,
    tenant_id: p.tenantId,
    lead_id: p.leadId,
    titular: p.lead,
    conversas: p.mensagens,
    agendamentos: p.agendamentos,
    canais: p.lead_canais,
    eventos: p.eventos,
    interacoes_ia: p.agent_runs,
    erros: p.erros,
  };
}

/** Monta o dump completo da conta. Garante que segredos nunca entrem. */
export function montarDumpTenant(
  geradoEm: string,
  tenantId: string,
  tabelas: Record<string, unknown[]>
) {
  const semSegredos: Record<string, unknown[]> = {};
  for (const chave of Object.keys(tabelas)) {
    if (chave === "app_tenant_secrets") continue; // trava dupla
    semSegredos[chave] = tabelas[chave];
  }
  return {
    formato: "lgpd-dump-conta-v1",
    gerado_em: geradoEm,
    tenant_id: tenantId,
    tabelas: semSegredos,
  };
}
