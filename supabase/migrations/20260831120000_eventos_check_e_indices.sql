-- (1) Corrige o CHECK de app_eventos.tipo: os tipos 'entrega_enviada' e
-- 'venda_reembolsada' já existem no código (TipoEvento) mas faltavam no CHECK,
-- então todo insert deles falhava (23514) e era engolido por registrarEvento —
-- o evento nunca era gravado (métrica de entrega/reembolso sempre vazia).
alter table public.app_eventos drop constraint if exists app_eventos_tipo_check;
alter table public.app_eventos
  add constraint app_eventos_tipo_check check (tipo in (
    'lead_received','first_response_sent','qualified','handoff_requested',
    'appointment_booked','appointment_attended','sale_won','revenue_confirmed',
    'lead_reactivated','entrega_enviada','venda_reembolsada'
  ));

-- (2) Índices de caminho quente (PERF-04): Contatos ordena por updated_at, o
-- gráfico do painel usa created_at, e o selo de comprador lê app_vendas por evento.
create index if not exists app_leads_tenant_updated_idx
  on public.app_leads (tenant_id, updated_at desc);
create index if not exists app_leads_tenant_created_idx
  on public.app_leads (tenant_id, created_at);
create index if not exists app_vendas_tenant_evento_idx
  on public.app_vendas (tenant_id, evento);
