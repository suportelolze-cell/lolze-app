-- Versionamento da persona do agente (dossiê §11: "reversão de versão do
-- agente"). A cada save da persona o estado ANTERIOR vira um snapshot aqui,
-- permitindo ver o histórico e reverter (undo). Só superadmin lê; escrita via
-- service_role. Aplicada em produção (nome: versionamento_persona_agente).
create table if not exists public.app_persona_versoes (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.app_tenants(id) on delete cascade,
  oferta          text,
  publico         text,
  tom             text,
  objecoes        text,
  faq             text,
  regras          text,
  origem          text not null default 'edicao' check (origem in ('edicao','rollback')),
  criado_por      uuid,
  criado_por_nome text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_app_persona_versoes_tenant
  on public.app_persona_versoes (tenant_id, created_at desc);

alter table public.app_persona_versoes enable row level security;
drop policy if exists app_persona_versoes_rls on public.app_persona_versoes;
create policy app_persona_versoes_rls on public.app_persona_versoes
  for select to authenticated
  using (public.app_is_superadmin());
grant all on table public.app_persona_versoes to anon, authenticated, service_role;
