-- "Um cliente, uma memória" (dossiê P1.2): um lead pode ter VÁRIAS identidades
-- de canal (WhatsApp, Instagram, ...). Os webhooks resolvem o lead por aqui;
-- mesclar contatos move as identidades — o histórico segue o cliente.
-- Aplicada em produção via ledger (nome: identidade_entre_canais); espelho do repo.
create table if not exists public.app_lead_canais (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.app_tenants(id) on delete cascade,
  lead_id       bigint not null references public.app_leads(id) on delete cascade,
  canal         text not null,
  canal_user_id text not null,
  created_at    timestamptz not null default now()
);

-- Uma identidade (canal, id no canal) pertence a exatamente um lead do tenant.
create unique index if not exists uq_app_lead_canais_identidade
  on public.app_lead_canais (tenant_id, canal, canal_user_id);
create index if not exists idx_app_lead_canais_lead
  on public.app_lead_canais (tenant_id, lead_id);

alter table public.app_lead_canais enable row level security;
drop policy if exists app_lead_canais_rls on public.app_lead_canais;
create policy app_lead_canais_rls on public.app_lead_canais
  for select to authenticated
  using (public.app_is_superadmin() or tenant_id = public.app_current_tenant());
grant all on table public.app_lead_canais to anon, authenticated, service_role;

-- Backfill: identidades atuais dos leads existentes (canal + canal_user_id).
insert into public.app_lead_canais (tenant_id, lead_id, canal, canal_user_id)
select l.tenant_id, l.id, l.canal, l.canal_user_id
from public.app_leads l
where l.canal is not null
  and l.canal_user_id is not null
  and l.canal in ('whatsapp','instagram')
on conflict (tenant_id, canal, canal_user_id) do nothing;
