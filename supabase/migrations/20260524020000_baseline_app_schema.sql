-- ============================================================================
-- Lolze — BASELINE do schema do aplicativo (tabelas app_*), RLS e funções
-- ============================================================================
-- Projeto Supabase: "SaaS Lolze" (CRM) — ref pphstbiwcaeldaoesuwl
--
-- Este arquivo é o retrato fiel do schema que o app usa hoje em produção,
-- extraído do catálogo do Postgres (pg_get_constraintdef / pg_get_functiondef /
-- pg_policies etc.). Serve para versionar o schema e reproduzir o banco do zero
-- (`supabase db reset`). É a "linha de base" — as migrações do ledger que vierem
-- depois (timestamp maior) aplicam por cima de forma incremental.
--
-- Timestamp propositalmente logo após a criação do projeto (2026-05-24) para
-- rodar ANTES de qualquer outra migração local.
--
-- ESCOPO: apenas as tabelas do app (prefixo app_). O banco também contém tabelas
-- legadas v1 (clients, leads, conversations, messages, bookings, integrations,
-- rag_*, stripe_*, ...) e de um produto separado de auditoria de site (audit_*)
-- que o código atual NÃO usa (a migração `lock_legacy_painel_objects` as trancou).
-- Elas foram DELIBERADAMENTE deixadas de fora deste baseline.
--
-- NOTA app_agent_runs: usada por src/lib/agent/runs.ts. Faltava em produção (o rascunho
-- 20260619_agent_sdr.sql nunca foi aplicado); foi criada em prod em 2026-07-19 pela
-- migração 20260719015109_add_app_agent_runs_observability.sql. Consta aqui no baseline
-- (retrato do estado atual) e também naquela migração idempotente — sem conflito.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extensões
-- ----------------------------------------------------------------------------
create extension if not exists vector with schema public;  -- embeddings do RAG (vector(1536))

-- ----------------------------------------------------------------------------
-- 1) Sequências das tabelas com id serial (as demais usam identity)
-- ----------------------------------------------------------------------------
create sequence if not exists public.app_agendamentos_id_seq;
create sequence if not exists public.app_kb_documents_id_seq;
create sequence if not exists public.app_rate_hits_id_seq;

-- ----------------------------------------------------------------------------
-- 2) Tabelas (colunas + PK/UNIQUE/CHECK inline; FKs adicionadas na seção 3)
-- ----------------------------------------------------------------------------

-- Planos oficiais (Start/Growth/Scale...). Referenciado por app_tenants.plano.
create table public.app_plans (
  id            text not null,
  nome          text not null,
  ordem         integer not null default 0,
  setup_cents   integer not null default 0,
  mensal_cents  integer not null default 0,
  canais_max    integer not null default 1,
  carencia_dias integer not null default 30,
  recursos      jsonb not null default '[]'::jsonb,
  ativo         boolean not null default true,
  sdr_max       integer not null default 3,
  stripe_price_id text,
  teto_ia_cents integer not null default 0,
  constraint app_plans_pkey primary key (id)
);

-- Clientes do SaaS (tenants). Raiz do isolamento multi-tenant.
create table public.app_tenants (
  id                     uuid not null default gen_random_uuid(),
  nome                   text not null,
  slug                   text,
  plano                  text not null default 'start'::text,
  status                 text not null default 'ativo'::text,
  canais                 jsonb not null default '[]'::jsonb,
  contato_email          text,
  contato_telefone       text,
  ativado_em             date not null default CURRENT_DATE,
  observacoes            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  stripe_customer_id     text,
  stripe_subscription_id text,
  constraint app_tenants_pkey primary key (id),
  constraint app_tenants_slug_key unique (slug)
);

-- Perfis de usuário (dono/SDR/superadmin). id = auth.users.id.
create table public.app_profiles (
  id         uuid not null,
  nome       text not null default ''::text,
  email      text,
  papel      text not null default 'admin'::text,
  created_at timestamptz not null default now(),
  tenant_id  uuid,
  constraint app_profiles_pkey primary key (id),
  constraint app_profiles_papel_check check (papel = any (array['superadmin'::text, 'owner'::text, 'membro'::text, 'admin'::text, 'sdr'::text]))
);

-- Configuração/persona por tenant (1:1 com app_tenants).
create table public.app_config (
  id                  text not null default (gen_random_uuid())::text,
  nome_negocio        text not null default ''::text,
  endereco            text not null default ''::text,
  email               text not null default ''::text,
  horario             text not null default ''::text,
  updated_at          timestamptz not null default now(),
  tenant_id           uuid not null,
  oferta              text not null default ''::text,
  publico             text not null default ''::text,
  tom                 text not null default ''::text,
  objecoes            text not null default ''::text,
  faq                 text not null default ''::text,
  regras              text not null default ''::text,
  agente_ativo        boolean not null default true,
  google_conectado    boolean not null default false,
  google_email        text not null default ''::text,
  whatsapp_conectado  boolean not null default false,
  whatsapp_numero     text,
  respostas_rapidas   text,
  antifaltas_24h      boolean not null default true,
  antifaltas_2h       boolean not null default true,
  antifaltas_resgate  boolean not null default false,
  agenda_abre         integer not null default 8,
  agenda_fecha        integer not null default 18,
  especialista_numero text,
  prospect_instancia  text,
  prospect_dia        integer not null default 10,
  prospect_ativo      boolean not null default false,
  prospect_instancias jsonb not null default '[]'::jsonb,
  onboarding_ok       boolean not null default false,
  constraint app_config_pkey primary key (id),
  constraint app_config_tenant_uniq unique (tenant_id)
);

-- Segredos por tenant (tokens de ingestão, Google, Evolution, Meta, IG).
create table public.app_tenant_secrets (
  tenant_id            uuid not null,
  ingest_token         text not null default (replace((gen_random_uuid())::text, '-'::text, ''::text) || replace((gen_random_uuid())::text, '-'::text, ''::text)),
  updated_at           timestamptz not null default now(),
  google_refresh_token text,
  google_calendar_id   text not null default 'primary'::text,
  evolution_instance   text,
  meta_ad_account_id   text,
  meta_access_token    text,
  ig_account_id        text,
  ig_access_token      text,
  constraint app_tenant_secrets_pkey primary key (tenant_id),
  constraint app_tenant_secrets_ingest_token_key unique (ingest_token)
);

-- Leads / CRM.
create table public.app_leads (
  id                  bigint generated always as identity,
  nome                text not null,
  telefone            text,
  email               text,
  origem              text not null default 'site'::text,
  temperatura         text not null default 'frio'::text,
  coluna              text not null default 'entrada'::text,
  valor               numeric,
  comando             text not null default 'ia'::text,
  precisa_humano      boolean not null default false,
  diagnostico         text,
  ultima_msg          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  tenant_id           uuid not null,
  atendente_id        uuid,
  ultimo_atendente_at timestamptz,
  canal               text,
  canal_user_id       text,
  aquisicao           text not null default 'organico'::text,
  anuncio             text,
  followup_count      integer not null default 0,
  proximo_followup    timestamptz,
  followup_modo       text,
  constraint app_leads_pkey primary key (id),
  constraint app_leads_aquisicao_check check (aquisicao = any (array['pago'::text, 'organico'::text])),
  constraint app_leads_coluna_check check (coluna = any (array['entrada'::text, 'qualificacao'::text, 'atencao'::text, 'agendado'::text, 'ganho'::text, 'perdido'::text])),
  constraint app_leads_comando_check check (comando = any (array['ia'::text, 'humano'::text])),
  constraint app_leads_origem_check check (origem = any (array['meta_ads'::text, 'google_ads'::text, 'site'::text, 'instagram'::text, 'whatsapp'::text, 'facebook'::text, 'telegram'::text, 'sms'::text, 'organico'::text, 'trafego_pago'::text, 'outro'::text])),
  constraint app_leads_temperatura_check check (temperatura = any (array['quente'::text, 'morno'::text, 'frio'::text]))
);

-- Mensagens da conversa.
create table public.app_mensagens (
  id         bigint generated always as identity,
  lead_id    bigint not null,
  autor      text not null,
  texto      text not null,
  created_at timestamptz not null default now(),
  tenant_id  uuid not null,
  midia_url  text,
  midia_tipo text,
  constraint app_mensagens_pkey primary key (id),
  constraint app_mensagens_autor_check check (autor = any (array['ia'::text, 'lead'::text, 'atendente'::text]))
);

-- Agendamentos (agenda do painel + espelho no Google Calendar).
create table public.app_agendamentos (
  id              bigint not null default nextval('public.app_agendamentos_id_seq'::regclass),
  tenant_id       uuid not null,
  lead_id         bigint,
  nome            text not null default ''::text,
  telefone        text,
  servico         text not null default 'Reunião'::text,
  inicio          timestamptz not null,
  fim             timestamptz,
  status          text not null default 'confirmado'::text,
  por_ia          boolean not null default false,
  origem          text,
  google_event_id text,
  notas           text,
  created_at      timestamptz not null default now(),
  lembrete_24h_em timestamptz,
  lembrete_2h_em  timestamptz,
  constraint app_agendamentos_pkey primary key (id)
);

-- Base de conhecimento (RAG) por tenant.
create table public.app_kb_documents (
  id         bigint not null default nextval('public.app_kb_documents_id_seq'::regclass),
  tenant_id  uuid not null,
  file_nome  text not null default 'documento'::text,
  content    text not null,
  metadata   jsonb not null default '{}'::jsonb,
  embedding  vector(1536),
  created_at timestamptz not null default now(),
  constraint app_kb_documents_pkey primary key (id)
);

-- Tráfego pago (métricas por dia/fonte).
create table public.app_trafego (
  id                 bigint generated always as identity,
  dia                date not null,
  fonte              text not null,
  cliques            integer not null default 0,
  investimento_cents integer not null default 0,
  visitantes         integer not null default 0,
  tenant_id          uuid not null,
  constraint app_trafego_pkey primary key (id),
  constraint app_trafego_fonte_check check (fonte = any (array['meta_ads'::text, 'google_ads'::text]))
);

-- Captação ativa (prospecção).
create table public.app_prospects (
  id           bigint generated always as identity,
  tenant_id    uuid not null,
  nome_empresa text,
  telefone     text not null,
  site         text,
  nicho        text,
  cidade       text,
  dados        jsonb,
  status       text not null default 'novo'::text,
  mensagem     text,
  erro         text,
  enviado_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint app_prospects_pkey primary key (id)
);

-- Observabilidade de erros.
create table public.app_erros (
  id         bigint generated always as identity,
  tenant_id  uuid,
  contexto   text not null,
  mensagem   text not null,
  detalhe    text,
  lead_id    bigint,
  severidade text not null default 'media'::text,
  created_at timestamptz not null default now(),
  constraint app_erros_pkey primary key (id)
);

-- Uso/custo de IA por tenant/dia.
create table public.app_uso_ia (
  tenant_id      uuid not null,
  dia            date not null,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  cache_creation bigint not null default 0,
  cache_read     bigint not null default 0,
  chamadas       integer not null default 0,
  updated_at     timestamptz not null default now(),
  constraint app_uso_ia_pkey primary key (tenant_id, dia)
);

-- Anti-abuso das telas públicas (throttle por IP).
create table public.app_rate_hits (
  id         bigint not null default nextval('public.app_rate_hits_id_seq'::regclass),
  bucket     text not null,
  ip         text not null,
  created_at timestamptz not null default now(),
  constraint app_rate_hits_pkey primary key (id)
);

-- Mural de ideias/novidades (roadmap participativo).
create table public.app_ideias (
  id            uuid not null default gen_random_uuid(),
  titulo        text not null,
  descricao     text not null default ''::text,
  status        text not null default 'analise'::text,
  autor_id      uuid,
  autor_nome    text,
  tenant_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  curtidas_base integer not null default 0,
  constraint app_ideias_pkey primary key (id)
);

create table public.app_ideia_comentarios (
  id           uuid not null default gen_random_uuid(),
  ideia_id     uuid not null,
  user_id      uuid,
  autor_nome   text,
  texto        text not null,
  created_at   timestamptz not null default now(),
  autor_admin  boolean not null default false,
  constraint app_ideia_comentarios_pkey primary key (id)
);

create table public.app_ideia_likes (
  ideia_id   uuid not null,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  constraint app_ideia_likes_pkey primary key (ideia_id, user_id)
);

-- Log de execuções dos agentes (SDR/Agendador/Suporte) — observabilidade e custo.
-- ATENÇÃO: ausente em produção; usada por src/lib/agent/runs.ts. Aplicar para sanar o drift.
create table public.app_agent_runs (
  id                    bigint generated always as identity,
  tenant_id             uuid not null,
  lead_id               bigint,
  agente                text not null,
  modelo                text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens     integer not null default 0,
  latencia_ms           integer not null default 0,
  acoes                 jsonb not null default '[]'::jsonb,
  resposta              text,
  erro                  text,
  created_at            timestamptz not null default now(),
  constraint app_agent_runs_pkey primary key (id),
  constraint app_agent_runs_agente_check check (agente = any (array['sdr'::text, 'agendador'::text, 'suporte'::text]))
);

-- ----------------------------------------------------------------------------
-- 3) Chaves estrangeiras (após todas as tabelas, para não depender da ordem)
-- ----------------------------------------------------------------------------
alter table public.app_tenants           add constraint app_tenants_plano_fkey            foreign key (plano)        references public.app_plans(id);
alter table public.app_profiles          add constraint app_profiles_id_fkey              foreign key (id)           references auth.users(id) on delete cascade;
alter table public.app_profiles          add constraint app_profiles_tenant_id_fkey       foreign key (tenant_id)    references public.app_tenants(id) on delete set null;
alter table public.app_config            add constraint app_config_tenant_id_fkey         foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_tenant_secrets    add constraint app_tenant_secrets_tenant_id_fkey foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_leads             add constraint app_leads_tenant_id_fkey          foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_leads             add constraint app_leads_atendente_id_fkey       foreign key (atendente_id) references public.app_profiles(id) on delete set null;
alter table public.app_mensagens         add constraint app_mensagens_tenant_id_fkey      foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_mensagens         add constraint app_mensagens_lead_id_fkey        foreign key (lead_id)      references public.app_leads(id) on delete cascade;
alter table public.app_agendamentos      add constraint app_agendamentos_tenant_id_fkey   foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_agendamentos      add constraint app_agendamentos_lead_id_fkey     foreign key (lead_id)      references public.app_leads(id) on delete set null;
alter table public.app_kb_documents      add constraint app_kb_documents_tenant_id_fkey   foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_trafego           add constraint app_trafego_tenant_id_fkey        foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;
alter table public.app_ideia_comentarios add constraint app_ideia_comentarios_ideia_id_fkey foreign key (ideia_id)  references public.app_ideias(id) on delete cascade;
alter table public.app_ideia_likes       add constraint app_ideia_likes_ideia_id_fkey     foreign key (ideia_id)     references public.app_ideias(id) on delete cascade;
alter table public.app_agent_runs        add constraint app_agent_runs_tenant_id_fkey     foreign key (tenant_id)    references public.app_tenants(id) on delete cascade;

-- Sequências pertencem às suas colunas (drop em cascata com a tabela).
alter sequence public.app_agendamentos_id_seq owned by public.app_agendamentos.id;
alter sequence public.app_kb_documents_id_seq  owned by public.app_kb_documents.id;
alter sequence public.app_rate_hits_id_seq     owned by public.app_rate_hits.id;

-- ----------------------------------------------------------------------------
-- 4) Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_app_tenants_plano             on public.app_tenants using btree (plano);
create index if not exists idx_app_profiles_tenant           on public.app_profiles using btree (tenant_id);
create index if not exists app_leads_coluna_idx              on public.app_leads using btree (coluna);
create index if not exists idx_app_leads_atendente           on public.app_leads using btree (atendente_id);
create index if not exists idx_app_leads_canal_user          on public.app_leads using btree (tenant_id, canal, canal_user_id);
create index if not exists idx_app_leads_proximo_followup    on public.app_leads using btree (proximo_followup) where (proximo_followup is not null);
create index if not exists idx_app_leads_tenant              on public.app_leads using btree (tenant_id);
create index if not exists app_mensagens_lead_idx            on public.app_mensagens using btree (lead_id);
create index if not exists idx_app_mensagens_tenant          on public.app_mensagens using btree (tenant_id);
create index if not exists idx_app_agendamentos_inicio       on public.app_agendamentos using btree (inicio) where (status <> 'cancelado'::text);
create index if not exists idx_app_agendamentos_lead         on public.app_agendamentos using btree (lead_id);
create index if not exists idx_app_agendamentos_tenant       on public.app_agendamentos using btree (tenant_id, inicio);
create index if not exists idx_app_kb_embedding              on public.app_kb_documents using hnsw (embedding vector_cosine_ops);
create index if not exists idx_app_kb_tenant                 on public.app_kb_documents using btree (tenant_id);
create index if not exists app_trafego_dia_idx               on public.app_trafego using btree (dia);
create index if not exists idx_app_trafego_tenant            on public.app_trafego using btree (tenant_id);
create index if not exists idx_app_prospects_status          on public.app_prospects using btree (tenant_id, status);
create unique index if not exists uq_app_prospects_tel       on public.app_prospects using btree (tenant_id, telefone);
create index if not exists idx_app_erros_contexto            on public.app_erros using btree (contexto, created_at desc);
create index if not exists idx_app_erros_created             on public.app_erros using btree (created_at desc);
create index if not exists idx_app_uso_ia_dia                on public.app_uso_ia using btree (dia);
create index if not exists idx_app_rate_hits_lookup          on public.app_rate_hits using btree (bucket, ip, created_at desc);
create index if not exists idx_app_ideias_created            on public.app_ideias using btree (created_at desc);
create index if not exists idx_app_ideias_status             on public.app_ideias using btree (status);
create index if not exists idx_app_ideia_com_ideia           on public.app_ideia_comentarios using btree (ideia_id);
create index if not exists idx_app_ideia_likes_ideia         on public.app_ideia_likes using btree (ideia_id);
create index if not exists app_agent_runs_tenant_created_idx on public.app_agent_runs using btree (tenant_id, created_at desc);
create index if not exists app_agent_runs_lead_idx           on public.app_agent_runs using btree (tenant_id, lead_id);

-- ----------------------------------------------------------------------------
-- 5) Funções (helpers de RLS + RPCs). Criadas depois das tabelas que elas leem.
-- ----------------------------------------------------------------------------

-- Tenant efetivo do usuário logado (do perfil). Usada nas policies.
create or replace function public.app_current_tenant()
  returns uuid
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select tenant_id from app_profiles where id = auth.uid();
$function$;

-- É superadmin? Usada nas policies.
create or replace function public.app_is_superadmin()
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select coalesce((select papel = 'superadmin' from app_profiles where id = auth.uid()), false);
$function$;

-- Trigger util: mantém updated_at.
create or replace function public.app_set_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
as $function$
begin new.updated_at = now(); return new; end; $function$;

-- RPC: acumula uso de IA por tenant/dia (upsert). Chamada server-side.
create or replace function public.incrementar_uso_ia(p_tenant uuid, p_dia date, p_in bigint, p_out bigint, p_cc bigint, p_cr bigint)
  returns void
  language sql
  security definer
  set search_path to 'public'
as $function$
  insert into public.app_uso_ia (tenant_id, dia, input_tokens, output_tokens, cache_creation, cache_read, chamadas, updated_at)
  values (p_tenant, p_dia, p_in, p_out, p_cc, p_cr, 1, now())
  on conflict (tenant_id, dia) do update set
    input_tokens   = app_uso_ia.input_tokens   + excluded.input_tokens,
    output_tokens  = app_uso_ia.output_tokens  + excluded.output_tokens,
    cache_creation = app_uso_ia.cache_creation + excluded.cache_creation,
    cache_read     = app_uso_ia.cache_read     + excluded.cache_read,
    chamadas       = app_uso_ia.chamadas       + 1,
    updated_at     = now();
$function$;

-- RPC: busca semântica no RAG (filtrada por metadata->tenant). Chamada server-side.
create or replace function public.match_app_kb(query_embedding vector, match_count integer default 5, filter jsonb default '{}'::jsonb)
  returns table(id bigint, content text, metadata jsonb, similarity double precision)
  language plpgsql
  stable
  set search_path to 'public'
as $function$
begin
  return query
  select d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from app_kb_documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 6) Triggers
-- ----------------------------------------------------------------------------
drop trigger if exists app_leads_updated_at on public.app_leads;
create trigger app_leads_updated_at
  before update on public.app_leads
  for each row execute function public.app_set_updated_at();

-- ----------------------------------------------------------------------------
-- 7) RLS + Políticas
-- ----------------------------------------------------------------------------
-- Padrão do app: "superadmin OU dono do tenant". Tabelas de bastidor
-- (erros/uso/prospects/rate_hits/ideias) ficam com RLS ligado e SEM policy —
-- só o service_role (server actions) acessa; authenticated/anon caem no deny.

alter table public.app_plans           enable row level security;
alter table public.app_tenants         enable row level security;
alter table public.app_profiles        enable row level security;
alter table public.app_config          enable row level security;
alter table public.app_tenant_secrets  enable row level security;
alter table public.app_leads           enable row level security;
alter table public.app_mensagens       enable row level security;
alter table public.app_agendamentos    enable row level security;
alter table public.app_kb_documents    enable row level security;
alter table public.app_trafego         enable row level security;
alter table public.app_prospects       enable row level security;  -- sem policy: só service_role
alter table public.app_erros           enable row level security;  -- sem policy: só service_role
alter table public.app_uso_ia          enable row level security;  -- sem policy: só service_role
alter table public.app_rate_hits       enable row level security;  -- sem policy: só service_role
alter table public.app_ideias          enable row level security;  -- sem policy: só service_role (server actions)
alter table public.app_ideia_comentarios enable row level security; -- sem policy: só service_role
alter table public.app_ideia_likes     enable row level security;  -- sem policy: só service_role
alter table public.app_agent_runs      enable row level security;

-- app_plans: todo autenticado lê; só superadmin escreve.
drop policy if exists plans_read on public.app_plans;
create policy plans_read on public.app_plans
  for select to authenticated using (true);
drop policy if exists plans_write on public.app_plans;
create policy plans_write on public.app_plans
  for all to authenticated using (app_is_superadmin()) with check (app_is_superadmin());

-- app_tenants: dono lê o próprio; superadmin faz tudo.
drop policy if exists tenants_own_read on public.app_tenants;
create policy tenants_own_read on public.app_tenants
  for select to authenticated using (id = app_current_tenant());
drop policy if exists tenants_super on public.app_tenants;
create policy tenants_super on public.app_tenants
  for all to authenticated using (app_is_superadmin()) with check (app_is_superadmin());

-- app_profiles: lê o próprio, do mesmo tenant, ou superadmin; escrita só superadmin.
drop policy if exists profiles_read on public.app_profiles;
create policy profiles_read on public.app_profiles
  for select to authenticated using ((id = auth.uid()) or app_is_superadmin() or (tenant_id = app_current_tenant()));
drop policy if exists profiles_super_write on public.app_profiles;
create policy profiles_super_write on public.app_profiles
  for all to authenticated using (app_is_superadmin()) with check (app_is_superadmin());

-- app_tenant_secrets: só superadmin.
drop policy if exists secrets_superadmin on public.app_tenant_secrets;
create policy secrets_superadmin on public.app_tenant_secrets
  for all to authenticated using (app_is_superadmin()) with check (app_is_superadmin());

-- app_kb_documents: só superadmin (o RAG é gerido no admin).
drop policy if exists kb_superadmin on public.app_kb_documents;
create policy kb_superadmin on public.app_kb_documents
  for all to authenticated using (app_is_superadmin()) with check (app_is_superadmin());

-- Tabelas por tenant: superadmin OU dono do tenant.
drop policy if exists tenant_rw on public.app_config;
create policy tenant_rw on public.app_config
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

drop policy if exists tenant_rw on public.app_leads;
create policy tenant_rw on public.app_leads
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

drop policy if exists tenant_rw on public.app_mensagens;
create policy tenant_rw on public.app_mensagens
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

drop policy if exists tenant_rw on public.app_trafego;
create policy tenant_rw on public.app_trafego
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

drop policy if exists agendamentos_rw on public.app_agendamentos;
create policy agendamentos_rw on public.app_agendamentos
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

-- app_agent_runs: mesma regra tenant (espelha o rascunho 20260619_agent_sdr.sql).
drop policy if exists app_agent_runs_rls on public.app_agent_runs;
create policy app_agent_runs_rls on public.app_agent_runs
  for all to authenticated using (app_is_superadmin() or (tenant_id = app_current_tenant())) with check (app_is_superadmin() or (tenant_id = app_current_tenant()));

-- ----------------------------------------------------------------------------
-- 8) Grants (padrão Supabase; o RLS acima é quem realmente restringe)
-- ----------------------------------------------------------------------------
grant all on table
  public.app_plans, public.app_tenants, public.app_profiles, public.app_config,
  public.app_tenant_secrets, public.app_leads, public.app_mensagens,
  public.app_agendamentos, public.app_kb_documents, public.app_trafego,
  public.app_prospects, public.app_erros, public.app_uso_ia, public.app_rate_hits,
  public.app_ideias, public.app_ideia_comentarios, public.app_ideia_likes,
  public.app_agent_runs
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Execução das funções: helpers de RLS para authenticated; RPCs de bastidor só service_role.
revoke all on function public.app_current_tenant()  from public;
revoke all on function public.app_is_superadmin()   from public;
revoke all on function public.app_set_updated_at()  from public;
revoke all on function public.incrementar_uso_ia(uuid, date, bigint, bigint, bigint, bigint) from public;
revoke all on function public.match_app_kb(vector, integer, jsonb) from public;

grant execute on function public.app_current_tenant() to authenticated, service_role;
grant execute on function public.app_is_superadmin()  to authenticated, service_role;
grant execute on function public.app_set_updated_at() to service_role;
grant execute on function public.incrementar_uso_ia(uuid, date, bigint, bigint, bigint, bigint) to service_role;
grant execute on function public.match_app_kb(vector, integer, jsonb) to service_role;
