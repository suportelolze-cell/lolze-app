-- Mensageria confiável (P0): status de entrega + dedup por id externo do canal.
-- Aplicada em produção via ledger em 2026-07-19; este arquivo mantém o repo em sincronia.
alter table public.app_mensagens add column if not exists status text;
alter table public.app_mensagens add column if not exists external_message_id text;
alter table public.app_mensagens add column if not exists tentativas integer not null default 0;
alter table public.app_mensagens add column if not exists ultimo_erro text;
alter table public.app_mensagens add column if not exists enviada_em timestamptz;

do $$ begin
  alter table public.app_mensagens add constraint app_mensagens_status_check
    check (status is null or status in ('pendente','enviada','entregue','lida','falhou'));
exception when duplicate_object then null; end $$;

-- Único por tenant+id externo (NULLs não conflitam): dedup das entradas por canal.
create unique index if not exists uq_app_mensagens_external
  on public.app_mensagens (tenant_id, external_message_id);
-- Mensagens falhadas por tenant (alerta/painel).
create index if not exists idx_app_mensagens_falhou
  on public.app_mensagens (tenant_id, created_at desc) where status = 'falhou';

-- Idempotência do webhook Stripe (cada evento processado uma única vez).
create table if not exists public.app_stripe_eventos (
  id         text primary key,
  tipo       text not null,
  created_at timestamptz not null default now()
);
alter table public.app_stripe_eventos enable row level security;
grant all on table public.app_stripe_eventos to anon, authenticated, service_role;
