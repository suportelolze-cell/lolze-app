-- Canal WhatsApp oficial (Cloud API da Meta), por tenant:
-- phone_number_id roteia o webhook para o cliente certo; o token envia mensagens.
-- Aplicada em produção via ledger (nome: whatsapp_cloud_api_fields); espelho do repo.
alter table public.app_tenant_secrets add column if not exists wa_phone_number_id text;
alter table public.app_tenant_secrets add column if not exists wa_access_token text;

-- Roteamento seguro: um phone_number_id pertence a no máximo um tenant.
create unique index if not exists uq_app_tenant_secrets_wa_phone
  on public.app_tenant_secrets (wa_phone_number_id)
  where wa_phone_number_id is not null;
