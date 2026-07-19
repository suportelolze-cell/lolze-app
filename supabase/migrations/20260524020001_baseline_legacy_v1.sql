-- ============================================================================
-- Lolze — BASELINE do schema LEGADO (v1 / painel antigo + auditoria de site)
-- ============================================================================
-- Projeto Supabase "SaaS Lolze" (CRM) — ref pphstbiwcaeldaoesuwl.
--
-- Retrato fiel (via catálogo do Postgres) das tabelas que o app ATUAL não usa,
-- mas que ainda existem no banco. Serve só para reprodução 100% do banco do zero
-- (`supabase db reset`). A migração `lock_legacy_painel_objects` já trancou o
-- acesso a esses objetos; as funções auxiliares (is_admin/current_client_id/...)
-- estão com EXECUTE só para service_role/postgres, então as policies abaixo, na
-- prática, negam para usuários autenticados comuns (estado "trancado" fiel à prod).
--
-- Timestamp logo após o baseline do app (roda depois). Independente do schema app_*
-- (não há FK cruzando as duas gerações).
--
-- Blocos: v1 CRM (clients, profiles, leads, conversations, messages, bookings,
-- integrations, payments, rag_*, stripe_*, agent_events, error_log, cached_*,
-- objections_detected, lead_score_history, conversation_summaries + views v_*) e
-- a ferramenta separada de auditoria de site (audit_sites, audit_scans).
--
-- Obs.: a função handle_new_user tem um trigger em auth.users (cria public.profiles
-- em novo signup). O trigger em auth.users NÃO é recriado aqui (interno do Supabase);
-- só a função é reproduzida.
-- ============================================================================

create extension if not exists vector with schema public;

-- ----------------------------------------------------------------------------
-- Sequências (colunas id serial)
-- ----------------------------------------------------------------------------
create sequence if not exists public.agent_events_id_seq;
create sequence if not exists public.cached_insights_id_seq;
create sequence if not exists public.cached_pagespeed_id_seq;
create sequence if not exists public.error_log_id_seq;
create sequence if not exists public.lead_score_history_id_seq;
create sequence if not exists public.objections_detected_id_seq;

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
create table public.clients (
  id                        uuid not null default gen_random_uuid(),
  name                      text not null,
  plan                      text not null default 'starter'::text,
  status                    text not null default 'active'::text,
  color                     text not null default '#15803D'::text,
  initials                  text,
  created_at                timestamptz not null default now(),
  last_seen_at              timestamptz not null default now(),
  stripe_account_id         text,
  stripe_connect_status     text default 'disconnected'::text,
  billing_status            text not null default 'pending'::text,
  monthly_price_brl         numeric(10,2) default 0,
  channels_enabled          jsonb not null default '{"whatsapp": true}'::jsonb,
  evolution_instance        text,
  whatsapp_phone            text,
  landing_url               text,
  owner_email               text,
  owner_name                text,
  trial_ends_at             timestamptz default (now() + '14 days'::interval),
  notes                     text,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  stripe_checkout_url       text,
  stripe_current_period_end timestamptz,
  plan_sku                  text,
  billing_period            text default 'month'::text,
  plan_addons               text[] default '{}'::text[],
  n8n_webhooks              jsonb not null default '{}'::jsonb,
  evolution_base            text,
  evolution_apikey          text,
  constraint clients_pkey primary key (id),
  constraint clients_evolution_instance_unique unique (evolution_instance),
  constraint clients_billing_period_check check (billing_period = any (array['month'::text, 'year'::text])),
  constraint clients_billing_status_check check (billing_status = any (array['pending'::text, 'trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text])),
  constraint clients_plan_check check (plan = any (array['starter'::text, 'pro'::text, 'enterprise'::text])),
  constraint clients_status_check check (status = any (array['active'::text, 'warning'::text, 'paused'::text])),
  constraint clients_stripe_connect_status_check check (stripe_connect_status = any (array['disconnected'::text, 'pending'::text, 'active'::text, 'rejected'::text]))
);

create table public.profiles (
  id         uuid not null,
  client_id  uuid,
  role       text not null default 'owner'::text,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_role_check check (role = any (array['admin'::text, 'client'::text, 'owner'::text, 'agent'::text]))
);

create table public.conversations (
  id               uuid not null default gen_random_uuid(),
  client_id        uuid,
  channel          text not null default 'whatsapp'::text,
  contact_phone    text,
  contact_name     text,
  ai_enabled       boolean not null default true,
  bant_status      text not null default 'cold'::text,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  human_takeover_at timestamptz,
  constraint conversations_pkey primary key (id),
  constraint conversations_client_id_channel_contact_phone_key unique (client_id, channel, contact_phone),
  constraint conversations_bant_status_check check (bant_status = any (array['cold'::text, 'warm'::text, 'hot'::text, 'qualified'::text])),
  constraint conversations_channel_check check (channel = any (array['whatsapp'::text, 'instagram'::text, 'site'::text]))
);

create table public.messages (
  id              uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  author          text not null,
  body            text not null,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_author_check check (author = any (array['lead'::text, 'ai'::text, 'human'::text, 'system'::text]))
);

create table public.leads (
  id                uuid not null default gen_random_uuid(),
  client_id         uuid not null,
  conversation_id   uuid,
  contact_phone     text,
  contact_name      text,
  contact_email     text,
  pain_point        text,
  budget_brl        numeric(10,2),
  is_decision_maker boolean,
  funnel_stage      text not null default 'sondagem'::text,
  current_score     integer not null default 0,
  payment_link      text,
  payment_status    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint leads_pkey primary key (id),
  constraint leads_funnel_stage_check check (funnel_stage = any (array['sondagem'::text, 'qualificacao'::text, 'objecao'::text, 'fechamento'::text, 'won'::text, 'lost'::text])),
  constraint leads_payment_status_check check (payment_status = any (array['pending'::text, 'paid'::text, 'expired'::text, 'canceled'::text]))
);

create table public.bookings (
  id              uuid not null default gen_random_uuid(),
  conversation_id uuid,
  closer_email    text,
  starts_at       timestamptz not null,
  google_event_id text,
  status          text not null default 'scheduled'::text,
  created_at      timestamptz not null default now(),
  constraint bookings_pkey primary key (id),
  constraint bookings_google_event_id_key unique (google_event_id),
  constraint bookings_status_check check (status = any (array['scheduled'::text, 'confirmed'::text, 'no_show'::text, 'done'::text, 'canceled'::text]))
);

create table public.integrations (
  id           uuid not null default gen_random_uuid(),
  client_id    uuid not null,
  channel      text not null,
  status       text not null default 'disconnected'::text,
  credentials  jsonb not null default '{}'::jsonb,
  webhook_url  text,
  last_sync_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  constraint integrations_pkey primary key (id),
  constraint integrations_client_id_channel_key unique (client_id, channel),
  constraint integrations_channel_check check (channel = any (array['whatsapp_evolution'::text, 'whatsapp_cloud'::text, 'instagram'::text, 'facebook'::text, 'telegram'::text, 'webchat'::text])),
  constraint integrations_status_check check (status = any (array['disconnected'::text, 'connecting'::text, 'connected'::text, 'error'::text, 'expired'::text]))
);

create table public.payments (
  id                     uuid not null default gen_random_uuid(),
  client_id              uuid,
  lead_id                uuid,
  stripe_payment_link_id text,
  stripe_session_id      text,
  amount_brl             numeric(10,2) not null,
  currency               text default 'brl'::text,
  status                 text not null default 'pending'::text,
  link_sent_at           timestamptz not null default now(),
  paid_at                timestamptz,
  constraint payments_pkey primary key (id),
  constraint payments_status_check check (status = any (array['pending'::text, 'paid'::text, 'expired'::text, 'canceled'::text]))
);

create table public.rag_documents (
  id          uuid not null default gen_random_uuid(),
  client_id   uuid not null,
  kind        text not null,
  title       text not null,
  source_file text,
  created_at  timestamptz not null default now(),
  constraint rag_documents_pkey primary key (id),
  constraint rag_documents_kind_check check (kind = any (array['case'::text, 'price'::text, 'service'::text, 'objection_handling'::text, 'script'::text, 'other'::text]))
);

create table public.rag_chunks (
  id          uuid not null default gen_random_uuid(),
  document_id uuid not null,
  client_id   uuid not null,
  chunk_index integer not null,
  body        text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  constraint rag_chunks_pkey primary key (id)
);

create table public.objections_detected (
  id              bigint not null default nextval('public.objections_detected_id_seq'::regclass),
  client_id       uuid,
  conversation_id uuid,
  category        text not null,
  raw_quote       text,
  resolved        boolean default false,
  detected_at     timestamptz not null default now(),
  constraint objections_detected_pkey primary key (id),
  constraint objections_detected_category_check check (category = any (array['preco'::text, 'tempo'::text, 'concorrente'::text, 'desconfianca'::text, 'autoridade'::text, 'outro'::text]))
);

create table public.lead_score_history (
  id            bigint not null default nextval('public.lead_score_history_id_seq'::regclass),
  lead_id       uuid not null,
  score         integer not null,
  reasoning     text,
  calculated_at timestamptz not null default now(),
  constraint lead_score_history_pkey primary key (id)
);

create table public.conversation_summaries (
  conversation_id          uuid not null,
  summary                  text not null,
  message_count_at_summary integer,
  updated_at               timestamptz not null default now(),
  constraint conversation_summaries_pkey primary key (conversation_id)
);

create table public.agent_events (
  id              bigint not null default nextval('public.agent_events_id_seq'::regclass),
  client_id       uuid,
  conversation_id uuid,
  kind            text not null,
  rtt_ms          integer,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint agent_events_pkey primary key (id)
);

create table public.error_log (
  id         bigint not null default nextval('public.error_log_id_seq'::regclass),
  workflow   text not null,
  node       text,
  message    text not null,
  stack      text,
  payload    jsonb,
  created_at timestamptz not null default now(),
  constraint error_log_pkey primary key (id)
);

create table public.cached_insights (
  id           bigint not null default nextval('public.cached_insights_id_seq'::regclass),
  payload      jsonb not null,
  model        text,
  generated_at timestamptz not null default now(),
  constraint cached_insights_pkey primary key (id)
);

create table public.cached_pagespeed (
  id         bigint not null default nextval('public.cached_pagespeed_id_seq'::regclass),
  url        text not null,
  strategy   text not null default 'mobile'::text,
  lcp_value  text,
  lcp_score  numeric(3,2),
  fid_value  text,
  fid_score  numeric(3,2),
  cls_value  text,
  cls_score  numeric(3,2),
  raw        jsonb,
  fetched_at timestamptz not null default now(),
  constraint cached_pagespeed_pkey primary key (id),
  constraint cached_pagespeed_strategy_check check (strategy = any (array['mobile'::text, 'desktop'::text]))
);

create table public.stripe_events (
  id           text not null,
  type         text not null,
  client_id    uuid,
  livemode     boolean not null,
  payload      jsonb not null,
  processed_at timestamptz not null default now(),
  constraint stripe_events_pkey primary key (id)
);

create table public.stripe_prices (
  sku           text not null,
  period        text not null,
  livemode      boolean not null,
  product_id    text not null,
  price_id      text not null,
  product_kind  text not null,
  channels      text[] not null,
  label         text not null,
  amount_brl    numeric(10,2) not null,
  active        boolean not null default true,
  display_order integer not null default 0,
  updated_at    timestamptz not null default now(),
  constraint stripe_prices_pkey primary key (sku, period, livemode),
  constraint stripe_prices_price_id_key unique (price_id),
  constraint stripe_prices_period_check check (period = any (array['month'::text, 'year'::text])),
  constraint stripe_prices_product_kind_check check (product_kind = any (array['base'::text, 'combo'::text, 'addon'::text, 'pack'::text]))
);

-- Ferramenta separada de auditoria de site.
create table public.audit_sites (
  id         uuid not null default gen_random_uuid(),
  owner_id   uuid not null,
  name       text not null,
  url        text not null,
  max_pages  integer not null default 20,
  created_at timestamptz not null default now(),
  constraint audit_sites_pkey primary key (id)
);

create table public.audit_scans (
  id          uuid not null default gen_random_uuid(),
  site_id     uuid not null,
  owner_id    uuid not null,
  status      text not null default 'queued'::text,
  source      text,
  summary     jsonb not null default '{}'::jsonb,
  pages       jsonb not null default '[]'::jsonb,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint audit_scans_pkey primary key (id)
);

-- ----------------------------------------------------------------------------
-- Chaves estrangeiras
-- ----------------------------------------------------------------------------
alter table public.profiles               add constraint profiles_id_fkey                    foreign key (id)              references auth.users(id) on delete cascade;
alter table public.profiles               add constraint profiles_client_id_fkey             foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.conversations          add constraint conversations_client_id_fkey        foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.messages               add constraint messages_conversation_id_fkey       foreign key (conversation_id) references public.conversations(id) on delete cascade;
alter table public.leads                  add constraint leads_client_id_fkey                 foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.leads                  add constraint leads_conversation_id_fkey           foreign key (conversation_id) references public.conversations(id) on delete set null;
alter table public.bookings               add constraint bookings_conversation_id_fkey        foreign key (conversation_id) references public.conversations(id) on delete set null;
alter table public.integrations           add constraint integrations_client_id_fkey          foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.payments               add constraint payments_client_id_fkey              foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.payments               add constraint payments_lead_id_fkey                foreign key (lead_id)         references public.leads(id) on delete set null;
alter table public.rag_documents          add constraint rag_documents_client_id_fkey         foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.rag_chunks             add constraint rag_chunks_client_id_fkey            foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.rag_chunks             add constraint rag_chunks_document_id_fkey          foreign key (document_id)     references public.rag_documents(id) on delete cascade;
alter table public.objections_detected    add constraint objections_detected_client_id_fkey        foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.objections_detected    add constraint objections_detected_conversation_id_fkey  foreign key (conversation_id) references public.conversations(id) on delete cascade;
alter table public.lead_score_history     add constraint lead_score_history_lead_id_fkey      foreign key (lead_id)         references public.leads(id) on delete cascade;
alter table public.conversation_summaries add constraint conversation_summaries_conversation_id_fkey foreign key (conversation_id) references public.conversations(id) on delete cascade;
alter table public.agent_events           add constraint agent_events_client_id_fkey         foreign key (client_id)       references public.clients(id) on delete cascade;
alter table public.agent_events           add constraint agent_events_conversation_id_fkey   foreign key (conversation_id) references public.conversations(id) on delete set null;
alter table public.stripe_events          add constraint stripe_events_client_id_fkey        foreign key (client_id)       references public.clients(id) on delete set null;
alter table public.audit_sites            add constraint audit_sites_owner_id_fkey           foreign key (owner_id)        references auth.users(id) on delete cascade;
alter table public.audit_scans            add constraint audit_scans_owner_id_fkey           foreign key (owner_id)        references auth.users(id) on delete cascade;
alter table public.audit_scans            add constraint audit_scans_site_id_fkey            foreign key (site_id)         references public.audit_sites(id) on delete cascade;

alter sequence public.agent_events_id_seq        owned by public.agent_events.id;
alter sequence public.cached_insights_id_seq     owned by public.cached_insights.id;
alter sequence public.cached_pagespeed_id_seq    owned by public.cached_pagespeed.id;
alter sequence public.error_log_id_seq           owned by public.error_log.id;
alter sequence public.lead_score_history_id_seq  owned by public.lead_score_history.id;
alter sequence public.objections_detected_id_seq owned by public.objections_detected.id;

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_evt_client_kind          on public.agent_events using btree (client_id, kind, created_at desc);
create index if not exists idx_evt_kind_created         on public.agent_events using btree (kind, created_at desc);
create index if not exists audit_scans_owner_idx        on public.audit_scans using btree (owner_id);
create index if not exists audit_scans_site_idx         on public.audit_scans using btree (site_id);
create index if not exists audit_sites_owner_idx        on public.audit_sites using btree (owner_id);
create index if not exists idx_bookings_starts          on public.bookings using btree (starts_at);
create index if not exists idx_bookings_status          on public.bookings using btree (status);
create index if not exists idx_cached_insights_generated on public.cached_insights using btree (generated_at desc);
create index if not exists idx_cached_pagespeed_fetched on public.cached_pagespeed using btree (url, strategy, fetched_at desc);
create index if not exists clients_stripe_customer_idx     on public.clients using btree (stripe_customer_id);
create index if not exists clients_stripe_subscription_idx on public.clients using btree (stripe_subscription_id);
create index if not exists idx_clients_last_seen        on public.clients using btree (last_seen_at desc);
create index if not exists idx_clients_status           on public.clients using btree (status);
create index if not exists idx_conv_bant                on public.conversations using btree (bant_status) where (bant_status <> 'cold'::text);
create index if not exists idx_conv_client_last         on public.conversations using btree (client_id, last_message_at desc);
create index if not exists idx_conv_phone               on public.conversations using btree (contact_phone);
create index if not exists idx_error_log_workflow       on public.error_log using btree (workflow, created_at desc);
create index if not exists idx_integrations_client      on public.integrations using btree (client_id, status);
create index if not exists idx_score_hist_lead          on public.lead_score_history using btree (lead_id, calculated_at desc);
create index if not exists idx_leads_client_stage       on public.leads using btree (client_id, funnel_stage, current_score desc);
create index if not exists idx_leads_phone              on public.leads using btree (contact_phone);
create index if not exists idx_msg_author               on public.messages using btree (author);
create index if not exists idx_msg_conv_created         on public.messages using btree (conversation_id, created_at);
create index if not exists idx_msg_unread               on public.messages using btree (conversation_id) where ((author = 'lead'::text) and (((meta ->> 'read'::text))::boolean is not true));
create index if not exists idx_objections_client_cat    on public.objections_detected using btree (client_id, category, detected_at desc);
create index if not exists idx_payments_client_status   on public.payments using btree (client_id, status);
create index if not exists idx_profiles_client          on public.profiles using btree (client_id);
create index if not exists idx_profiles_role            on public.profiles using btree (role);
create index if not exists idx_rag_chunks_client        on public.rag_chunks using btree (client_id);
create index if not exists idx_rag_chunks_embedding     on public.rag_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_rag_docs_client_kind     on public.rag_documents using btree (client_id, kind);
create index if not exists stripe_events_client_idx     on public.stripe_events using btree (client_id, processed_at desc);
create index if not exists stripe_events_type_idx       on public.stripe_events using btree (type, processed_at desc);

-- ----------------------------------------------------------------------------
-- Funções (legado). EXECUTE só service_role/postgres (estado "trancado" da prod).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false)
$function$;

create or replace function public.current_client_id()
  returns uuid
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select client_id from public.profiles where id = auth.uid()
$function$;

create or replace function public."current_role"()
  returns text
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select role from public.profiles where id = auth.uid()
$function$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role, client_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    nullif(new.raw_user_meta_data->>'client_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.rag_search(query_embedding vector, client_id_filter uuid, match_count integer default 5)
  returns table(id uuid, body text, similarity double precision)
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select
    c.id,
    c.body,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_chunks c
  where c.client_id = client_id_filter
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$function$;

create or replace function public.dashboard_metrics(p_client_id uuid, p_days integer default 30)
  returns jsonb
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  WITH win AS (SELECT (now() - make_interval(days => p_days)) AS since),
  conv AS (
    SELECT c.id, c.channel, c.bant_status, c.created_at
    FROM conversations c, win
    WHERE c.client_id = p_client_id AND c.created_at >= win.since
  ),
  bk AS (
    SELECT b.id, b.status, b.starts_at, b.created_at,
           COALESCE(cv.channel,'desconhecido') AS channel
    FROM bookings b
    JOIN conversations cv ON cv.id = b.conversation_id
    , win
    WHERE cv.client_id = p_client_id AND b.created_at >= win.since
  ),
  ld AS (
    SELECT l.id, l.funnel_stage, l.payment_status,
           COALESCE(cv.channel,'desconhecido') AS channel
    FROM leads l
    LEFT JOIN conversations cv ON cv.id = l.conversation_id
    , win
    WHERE l.client_id = p_client_id AND l.created_at >= win.since
  )
  SELECT jsonb_build_object(
    'days', p_days,
    'kpis', jsonb_build_object(
      'conversations', (SELECT count(*) FROM conv),
      'bookings',      (SELECT count(*) FROM bk WHERE status IN ('scheduled','confirmed','done')),
      'leads',         (SELECT count(*) FROM ld),
      'closed',        (SELECT count(*) FROM ld WHERE payment_status = 'paid'),
      'hot_leads',     (SELECT count(*) FROM conv WHERE bant_status IN ('hot','qualified')),
      'conversion_pct',(SELECT CASE WHEN count(*)=0 THEN 0
                         ELSE round(100.0*count(*) FILTER (WHERE payment_status='paid')/count(*),1) END FROM ld)
    ),
    'by_channel', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'conversations')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'channel', ch,
          'conversations',(SELECT count(*) FROM conv WHERE COALESCE(conv.channel,'desconhecido')=ch),
          'bookings',     (SELECT count(*) FROM bk WHERE bk.channel=ch AND bk.status IN ('scheduled','confirmed','done')),
          'closed',       (SELECT count(*) FROM ld WHERE ld.channel=ch AND ld.payment_status='paid')
        ) AS row
        FROM (
          SELECT DISTINCT COALESCE(channel,'desconhecido') AS ch FROM conv
          UNION SELECT DISTINCT channel FROM bk
          UNION SELECT DISTINCT channel FROM ld
        ) channels
      ) rows
    ), '[]'::jsonb),
    'funnel', COALESCE((
      SELECT jsonb_object_agg(stage, cnt)
      FROM (SELECT COALESCE(funnel_stage,'sondagem') AS stage, count(*) AS cnt FROM ld GROUP BY 1) f
    ), '{}'::jsonb)
  );
$function$;

-- ----------------------------------------------------------------------------
-- Views
-- ----------------------------------------------------------------------------
create or replace view public.v_agent_stats_30d as
 SELECT ( SELECT count(DISTINCT conversations.contact_phone) AS count
           FROM conversations
          WHERE conversations.last_message_at > (now() - '30 days'::interval)) AS total_leads,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.created_at > (now() - '30 days'::interval) AND bookings.status <> 'canceled'::text) AS agendamentos,
    (( SELECT count(*) FILTER (WHERE conversations.bant_status = ANY (ARRAY['hot'::text, 'qualified'::text]))::double precision / NULLIF(count(*), 0)::double precision * 100::double precision
           FROM conversations
          WHERE conversations.created_at > (now() - '30 days'::interval)))::numeric(5,1) AS taxa_conversao_pct;

create or replace view public.v_clients_full as
 SELECT id, name, plan, status, color, initials, billing_status, monthly_price_brl,
    channels_enabled, plan_sku, billing_period, plan_addons, evolution_instance,
    whatsapp_phone, landing_url, owner_email, owner_name, trial_ends_at, last_seen_at,
    created_at, stripe_account_id, stripe_connect_status, stripe_customer_id,
    stripe_subscription_id, stripe_checkout_url, stripe_current_period_end,
    COALESCE(( SELECT count(*)::integer AS count
           FROM leads l
          WHERE l.client_id = c.id AND l.created_at > (now() - '30 days'::interval)), 0) AS leads_30d,
    COALESCE(( SELECT round(100.0 * sum(
                CASE WHEN l.payment_status = 'paid'::text THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1)::double precision AS round
           FROM leads l
          WHERE l.client_id = c.id AND l.created_at > (now() - '30 days'::interval)), 0::double precision) AS conversion_pct,
    COALESCE(( SELECT sp.label
           FROM stripe_prices sp
          WHERE sp.sku = c.plan_sku AND sp.period = COALESCE(c.billing_period, 'month'::text) AND sp.livemode = false
         LIMIT 1), '—'::text) AS plan_label
   FROM clients c;

create or replace view public.v_leads_recent as
 SELECT c.id, c.client_id, c.contact_name AS name, c.contact_phone AS phone, c.bant_status,
    c.last_message_at, c.created_at,
    upper("left"(COALESCE(c.contact_name, '?'::text), 1) || COALESCE("left"(split_part(c.contact_name, ' '::text, 2), 1), ''::text)) AS initials,
        CASE c.bant_status
            WHEN 'qualified'::text THEN 'BANT'::text
            WHEN 'hot'::text THEN 'BANT'::text
            WHEN 'warm'::text THEN 'Em qualificação'::text
            WHEN 'cold'::text THEN 'Aguardando'::text
            ELSE 'Frio'::text
        END AS status_label,
    c.bant_status = ANY (ARRAY['hot'::text, 'qualified'::text]) AS hot,
    COALESCE(cl.name, '—'::text) AS company,
    (( SELECT EXTRACT(epoch FROM min(m.created_at) - c.created_at) AS "extract"
           FROM messages m
          WHERE m.conversation_id = c.id AND m.author = 'ai'::text))::integer AS response_time_seconds
   FROM conversations c
     LEFT JOIN clients cl ON cl.id = c.client_id
  ORDER BY c.last_message_at DESC;

-- ----------------------------------------------------------------------------
-- RLS + Políticas (fiel à prod; helpers travados => nega para usuário comum)
-- ----------------------------------------------------------------------------
alter table public.clients                enable row level security;
alter table public.profiles               enable row level security;
alter table public.conversations          enable row level security;
alter table public.messages               enable row level security;
alter table public.leads                  enable row level security;
alter table public.bookings               enable row level security;
alter table public.integrations           enable row level security;
alter table public.payments               enable row level security;
alter table public.rag_documents          enable row level security;
alter table public.rag_chunks             enable row level security;
alter table public.objections_detected    enable row level security;
alter table public.lead_score_history     enable row level security;
alter table public.conversation_summaries enable row level security;
alter table public.agent_events           enable row level security;
alter table public.error_log              enable row level security;
alter table public.cached_insights        enable row level security;
alter table public.cached_pagespeed       enable row level security;
alter table public.stripe_events          enable row level security;  -- sem policy: só service_role
alter table public.stripe_prices          enable row level security;
alter table public.audit_sites            enable row level security;
alter table public.audit_scans            enable row level security;

create policy "tenant or admin read clients" on public.clients
  for select to public using ((id = current_client_id()) or is_admin());
create policy "admin writes clients" on public.clients
  for all to public using (is_admin()) with check (is_admin());

create policy "read own profile or admin" on public.profiles
  for select to public using ((auth.uid() = id) or is_admin());
create policy "update own profile" on public.profiles
  for update to public using (auth.uid() = id) with check (auth.uid() = id);
create policy "admin updates any profile" on public.profiles
  for update to public using (is_admin()) with check (is_admin());

create policy "tenant or admin read conversations" on public.conversations
  for select to public using ((client_id = current_client_id()) or is_admin());
create policy "conversations_tenant_update" on public.conversations
  for update to authenticated
  using (client_id in ( select profiles.client_id from profiles where (profiles.id = auth.uid())))
  with check (client_id in ( select profiles.client_id from profiles where (profiles.id = auth.uid())));

create policy "tenant or admin read messages" on public.messages
  for select to public using (exists ( select 1 from conversations c where ((c.id = messages.conversation_id) and ((c.client_id = current_client_id()) or is_admin()))));
create policy "messages_tenant_insert_human" on public.messages
  for insert to authenticated
  with check ((author = 'human'::text) and (exists ( select 1 from conversations c where ((c.id = messages.conversation_id) and (c.client_id in ( select profiles.client_id from profiles where (profiles.id = auth.uid())))))));

create policy "tenant_or_admin_read_leads" on public.leads
  for select to public using ((client_id = current_client_id()) or is_admin());
create policy "admin_write_leads" on public.leads
  for all to public using (is_admin()) with check (is_admin());

create policy "tenant or admin read bookings" on public.bookings
  for select to public using (is_admin() or (exists ( select 1 from conversations c where ((c.id = bookings.conversation_id) and (c.client_id = current_client_id())))));

create policy "tenant_or_admin_read_integrations" on public.integrations
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "tenant_or_admin_read_payments" on public.payments
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "tenant_or_admin_read_rag_docs" on public.rag_documents
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "tenant_or_admin_read_rag_chunks" on public.rag_chunks
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "tenant_or_admin_read_objections" on public.objections_detected
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "tenant_or_admin_read_score_hist" on public.lead_score_history
  for select to public using (exists ( select 1 from leads l where ((l.id = lead_score_history.lead_id) and ((l.client_id = current_client_id()) or is_admin()))));

create policy "tenant_or_admin_read_summaries" on public.conversation_summaries
  for select to public using (exists ( select 1 from conversations c where ((c.id = conversation_summaries.conversation_id) and ((c.client_id = current_client_id()) or is_admin()))));

create policy "tenant or admin read agent_events" on public.agent_events
  for select to public using ((client_id = current_client_id()) or is_admin());

create policy "service only error_log" on public.error_log
  for select to public using (false);

create policy "admin or any tenant read cached_insights" on public.cached_insights
  for select to public using (true);

create policy "admin or any tenant read cached_pagespeed" on public.cached_pagespeed
  for select to public using (true);

create policy "stripe_prices_read_all" on public.stripe_prices
  for select to authenticated using (active = true);

create policy "audit_sites_select_own" on public.audit_sites
  for select to public using (auth.uid() = owner_id);
create policy "audit_sites_insert_own" on public.audit_sites
  for insert to public with check (auth.uid() = owner_id);
create policy "audit_sites_update_own" on public.audit_sites
  for update to public using (auth.uid() = owner_id);
create policy "audit_sites_delete_own" on public.audit_sites
  for delete to public using (auth.uid() = owner_id);

create policy "audit_scans_select_own" on public.audit_scans
  for select to public using (auth.uid() = owner_id);
create policy "audit_scans_insert_own" on public.audit_scans
  for insert to public with check (auth.uid() = owner_id);
create policy "audit_scans_update_own" on public.audit_scans
  for update to public using (auth.uid() = owner_id);
create policy "audit_scans_delete_own" on public.audit_scans
  for delete to public using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
grant all on table
  public.clients, public.profiles, public.conversations, public.messages,
  public.leads, public.bookings, public.integrations, public.payments,
  public.rag_documents, public.rag_chunks, public.objections_detected,
  public.lead_score_history, public.conversation_summaries, public.agent_events,
  public.error_log, public.cached_insights, public.cached_pagespeed,
  public.stripe_events, public.stripe_prices, public.audit_sites, public.audit_scans
  to anon, authenticated, service_role;

grant select on public.v_agent_stats_30d, public.v_clients_full, public.v_leads_recent
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Funções legadas: EXECUTE só service_role (fiel ao estado travado da produção).
revoke all on function public.is_admin()                                          from public;
revoke all on function public.current_client_id()                                 from public;
revoke all on function public."current_role"()                                    from public;
revoke all on function public.handle_new_user()                                   from public;
revoke all on function public.rag_search(vector, uuid, integer)                   from public;
revoke all on function public.dashboard_metrics(uuid, integer)                    from public;

grant execute on function public.is_admin()                                       to service_role;
grant execute on function public.current_client_id()                              to service_role;
grant execute on function public."current_role"()                                 to service_role;
grant execute on function public.handle_new_user()                                to service_role;
grant execute on function public.rag_search(vector, uuid, integer)                to service_role;
grant execute on function public.dashboard_metrics(uuid, integer)                 to service_role;
