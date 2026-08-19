-- Ingestão de checkout (Fase 1 do pivô p/ infoproduto).
-- Recebe webhooks de plataformas de venda (Ticto, Hotmart, Kiwify) e normaliza
-- num modelo canônico de venda (app_vendas). Cada plataforma é um adapter fino
-- no código; aqui ficam só o armazenamento e a configuração por tenant.
--
-- Segurança: ambas as tabelas têm RLS ligado SEM policy → acessíveis apenas
-- pelo service_role (mesma abordagem de app_prospects/app_erros). O segredo de
-- assinatura do webhook (hottok/token/hmac) é sensível e nunca vai ao cliente.

-- Configuração da integração por tenant + plataforma.
create table if not exists public.app_checkout_integracoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.app_tenants(id) on delete cascade,
  plataforma text not null check (plataforma in ('hotmart','ticto','kiwify')),
  -- token que identifica o tenant+integração na URL do webhook (?t=...).
  ingest_token text not null,
  -- segredo de validação da assinatura do webhook (hottok/token/hmac key).
  secret text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint app_checkout_integracoes_token_uk unique (ingest_token),
  constraint app_checkout_integracoes_tenant_plat_uk unique (tenant_id, plataforma)
);

alter table public.app_checkout_integracoes enable row level security;
-- Sem policy: só service_role (o app lê/gerencia via server, o segredo é sensível).

-- Vendas canônicas (todas as plataformas normalizadas neste formato).
create table if not exists public.app_vendas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.app_tenants(id) on delete cascade,
  lead_id bigint references public.app_leads(id) on delete set null,
  plataforma text not null,
  -- id da transação na plataforma (chave de idempotência junto com evento).
  external_id text not null,
  -- evento canônico: compra_aprovada | pix_gerado | boleto_gerado |
  -- checkout_abandonado | reembolso | chargeback | assinatura_cancelada | outro
  evento text not null,
  status text,
  produto_nome text,
  oferta text,
  valor_cents integer not null default 0,
  moeda text not null default 'BRL',
  metodo_pagamento text,
  comprador_nome text,
  comprador_email text,
  comprador_telefone text,
  raw jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

alter table public.app_vendas enable row level security;
-- Sem policy: só service_role (leitura via server code com getCrmAdmin).

-- Idempotência: o mesmo evento da mesma transação entra uma vez só
-- (retentativa do provedor não duplica). O ciclo de vida (pix_gerado depois
-- compra_aprovada) é permitido porque o evento faz parte da chave.
create unique index if not exists app_vendas_idempotencia_uk
  on public.app_vendas (tenant_id, plataforma, external_id, evento);

create index if not exists app_vendas_tenant_criado_idx
  on public.app_vendas (tenant_id, criado_em desc);
create index if not exists app_vendas_tenant_lead_idx
  on public.app_vendas (tenant_id, lead_id);
