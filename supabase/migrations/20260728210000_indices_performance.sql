-- Índices de performance nos caminhos mais quentes (aditivos). Já aplicados em
-- prod via MCP; este arquivo é o registro versionado. Tabelas pequenas no
-- estágio atual → create index direto é instantâneo (em escala, usar CONCURRENTLY).

-- app_mensagens: histórico por lead (SDR a cada turno, Central no poll, Hoje).
create index if not exists idx_app_mensagens_tenant_lead_id
  on public.app_mensagens (tenant_id, lead_id, id desc);

-- app_erros: count de erros 'alta' por tenant na tela Hoje.
create index if not exists idx_app_erros_tenant_sev
  on public.app_erros (tenant_id, created_at desc) where severidade = 'alta';

-- app_eventos: janela temporal do Resultados (sem fixar tipo).
create index if not exists idx_app_eventos_tenant_created
  on public.app_eventos (tenant_id, created_at desc);

-- app_agendamentos: recorrência/churn (só confirmados/concluídos).
create index if not exists idx_app_agendamentos_tenant_ativos
  on public.app_agendamentos (tenant_id, inicio) where status in ('confirmado','concluido');
