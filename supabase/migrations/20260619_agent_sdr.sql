-- ============================================================================
-- Lolze — Camada de IA (SDR): persona por tenant + observabilidade de execuções
-- Projeto Supabase: "SaaS Lolze" (CRM). Idempotente — seguro rodar mais de uma vez.
-- ============================================================================

-- 1) Persona do agente por cliente (colunas opcionais lidas pelo SDR).
alter table public.app_config add column if not exists oferta       text;
alter table public.app_config add column if not exists publico      text;
alter table public.app_config add column if not exists tom          text;
alter table public.app_config add column if not exists regras       text;
alter table public.app_config add column if not exists objecoes     text;
alter table public.app_config add column if not exists faq          text;
alter table public.app_config add column if not exists agente_ativo boolean not null default true;

-- 2) Log de execuções dos agentes (SDR/Agendador/Suporte) — observabilidade e custo.
create table if not exists public.app_agent_runs (
  id                     bigint generated always as identity primary key,
  tenant_id              uuid not null references public.app_tenants(id) on delete cascade,
  lead_id               bigint,
  agente                 text not null check (agente in ('sdr','agendador','suporte')),
  modelo                 text not null,
  input_tokens           integer not null default 0,
  output_tokens          integer not null default 0,
  cache_creation_tokens  integer not null default 0,
  cache_read_tokens      integer not null default 0,
  latencia_ms            integer not null default 0,
  acoes                  jsonb   not null default '[]'::jsonb,
  resposta               text,
  erro                   text,
  created_at             timestamptz not null default now()
);

create index if not exists app_agent_runs_tenant_created_idx
  on public.app_agent_runs (tenant_id, created_at desc);
create index if not exists app_agent_runs_lead_idx
  on public.app_agent_runs (tenant_id, lead_id);

-- 3) RLS: mesma regra das demais app_* (superadmin OU dono do tenant).
alter table public.app_agent_runs enable row level security;

drop policy if exists app_agent_runs_rls on public.app_agent_runs;
create policy app_agent_runs_rls on public.app_agent_runs
  for all
  to authenticated
  using (public.app_is_superadmin() or tenant_id = public.app_current_tenant())
  with check (public.app_is_superadmin() or tenant_id = public.app_current_tenant());
