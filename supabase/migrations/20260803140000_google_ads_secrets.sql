-- Credenciais do Google Ads por tenant (ingestão → app_trafego, fonte
-- 'google_ads'). Espelha o Meta (meta_ad_account_id / meta_access_token), mas o
-- Google usa OAuth: guardamos o customer id da conta de anúncios e um refresh
-- token com escopo `adwords` (o superadmin cola no admin, como no Meta). O
-- refresh token é trocado por um access token a cada sincronização.
--
-- O escopo `adwords` NÃO é o mesmo do Google Calendar (calendar.events) já
-- integrado — por isso um refresh token DEDICADO, e não o google_refresh_token
-- do Calendar (que faria o consentimento de agenda pedir acesso ao Google Ads).
--
-- O índice único de app_trafego (tenant_id, dia, fonte) já existe da migração
-- 20260803120000 (Meta) e é reaproveitado no upsert idempotente do Google.
--
-- AINDA NÃO aplicada em produção (mandato §2 — decisão de Abner).
alter table public.app_tenant_secrets
  add column if not exists google_ads_customer_id   text,
  add column if not exists google_ads_refresh_token  text;
