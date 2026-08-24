-- Entrega automática pós-compra (Fase 3 do pivô p/ infoproduto).
-- Guarda, por tenant, a mensagem de entrega do acesso ao produto. A chave é a
-- 'oferta' da venda (venda.oferta); oferta = '' é a mensagem PADRÃO do tenant
-- (fallback quando não há uma específica para o produto).
--
-- Segurança: RLS ligado SEM policy → só service_role (o app lê/escreve via
-- server), igual a app_vendas / app_checkout_integracoes.

create table if not exists public.app_entregas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.app_tenants(id) on delete cascade,
  oferta text not null default '',
  mensagem text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_entregas_tenant_oferta_uk unique (tenant_id, oferta)
);

alter table public.app_entregas enable row level security;
-- Sem policy: só service_role.

create index if not exists app_entregas_tenant_idx on public.app_entregas(tenant_id);
