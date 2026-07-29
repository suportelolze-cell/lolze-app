-- Biblioteca de mídia por tenant: arquivos prontos (tabela de preços, fotos,
-- vídeos, catálogos…) que a IA pode ENVIAR ao lead conforme o rótulo
-- "quando_usar". Reusa o bucket 'midias' (path sob o prefixo do tenant).

create table if not exists public.app_biblioteca_midia (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.app_tenants(id) on delete cascade,
  nome text not null,
  quando_usar text not null default '',
  tipo text not null, -- imagem | video | audio | documento
  path text not null, -- caminho no bucket 'midias'
  mime text,
  filename text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_biblioteca_midia enable row level security;

drop policy if exists app_biblioteca_midia_rw on public.app_biblioteca_midia;
create policy app_biblioteca_midia_rw on public.app_biblioteca_midia
  for all
  using (app_is_superadmin() or tenant_id = app_current_tenant())
  with check (app_is_superadmin() or tenant_id = app_current_tenant());

create index if not exists app_biblioteca_midia_tenant_idx on public.app_biblioteca_midia(tenant_id);
