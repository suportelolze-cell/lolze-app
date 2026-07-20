-- Ledger de eventos do funil (dossiê P1/seção 10): snapshot do lead continua
-- em app_leads para operação; AQUI ficam os fatos imutáveis para análise —
-- conversão por coorte, atribuição de receita e a futura tela "Hoje"/Resultados.
-- Aplicada em produção via ledger (nome: ledger_de_eventos); espelho do repo.
create table if not exists public.app_eventos (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.app_tenants(id) on delete cascade,
  lead_id     bigint references public.app_leads(id) on delete cascade,
  tipo        text not null check (tipo in (
    'lead_received','first_response_sent','qualified','handoff_requested',
    'appointment_booked','appointment_attended','sale_won','revenue_confirmed',
    'lead_reactivated'
  )),
  canal       text,
  origem      text,
  valor_cents integer,
  dados       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_app_eventos_tenant_tipo
  on public.app_eventos (tenant_id, tipo, created_at desc);
create index if not exists idx_app_eventos_lead
  on public.app_eventos (tenant_id, lead_id);
-- Eventos one-shot por lead (1ª ocorrência é a que vale): duplicata é rejeitada
-- pelo índice e ignorada pelo helper (análise de "tempo até X" fica trivial).
create unique index if not exists uq_app_eventos_oneshot
  on public.app_eventos (tenant_id, lead_id, tipo)
  where tipo in ('lead_received','first_response_sent','qualified','handoff_requested','sale_won');

alter table public.app_eventos enable row level security;
drop policy if exists app_eventos_rls on public.app_eventos;
create policy app_eventos_rls on public.app_eventos
  for select to authenticated
  using (public.app_is_superadmin() or tenant_id = public.app_current_tenant());
grant all on table public.app_eventos to anon, authenticated, service_role;
