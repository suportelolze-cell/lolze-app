-- Trilha de auditoria de alterações no agente/configuração (dossiê §11:
-- "registrar auditoria de alterações no agente e configurações"). Append-only,
-- só superadmin lê; escrita via service_role. tenant_id com ON DELETE SET NULL
-- (não cascade) para PRESERVAR o registro mesmo quando o cliente é excluído.
-- Aplicada em produção (nome: log_auditoria_admin).
create table if not exists public.app_auditoria (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references public.app_tenants(id) on delete set null,
  ator_id     uuid,
  ator_nome   text,
  acao        text not null,
  alvo        text,
  detalhe     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_app_auditoria_created on public.app_auditoria (created_at desc);
create index if not exists idx_app_auditoria_tenant on public.app_auditoria (tenant_id, created_at desc);

alter table public.app_auditoria enable row level security;
drop policy if exists app_auditoria_rls on public.app_auditoria;
create policy app_auditoria_rls on public.app_auditoria
  for select to authenticated
  using (public.app_is_superadmin());
grant all on table public.app_auditoria to anon, authenticated, service_role;
