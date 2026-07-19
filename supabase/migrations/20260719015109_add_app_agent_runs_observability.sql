-- Observabilidade de execuções dos agentes (usada por src/lib/agent/runs.ts).
-- Estava ausente em produção (o rascunho 20260619_agent_sdr.sql nunca foi aplicado).
-- Aplicada em produção (ledger) em 2026-07-19; este arquivo mantém o repo em sincronia.
create table if not exists public.app_agent_runs (
  id                    bigint generated always as identity primary key,
  tenant_id             uuid not null references public.app_tenants(id) on delete cascade,
  lead_id               bigint,
  agente                text not null check (agente in ('sdr','agendador','suporte')),
  modelo                text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens     integer not null default 0,
  latencia_ms           integer not null default 0,
  acoes                 jsonb not null default '[]'::jsonb,
  resposta              text,
  erro                  text,
  created_at            timestamptz not null default now()
);

create index if not exists app_agent_runs_tenant_created_idx on public.app_agent_runs (tenant_id, created_at desc);
create index if not exists app_agent_runs_lead_idx           on public.app_agent_runs (tenant_id, lead_id);

alter table public.app_agent_runs enable row level security;

drop policy if exists app_agent_runs_rls on public.app_agent_runs;
create policy app_agent_runs_rls on public.app_agent_runs
  for all to authenticated
  using (public.app_is_superadmin() or tenant_id = public.app_current_tenant())
  with check (public.app_is_superadmin() or tenant_id = public.app_current_tenant());

grant all on table public.app_agent_runs to anon, authenticated, service_role;
