-- Funil da PRÓPRIA Lolze (dossiê P1.4): eventos internos da jornada
-- landing → diagnóstico → demo → aplicação → cadastro → checkout → pagamento → ativação.
-- Sem tenant (é o funil do SaaS); leitura futura em painel do admin.
-- Aplicada em produção via ledger (nome: funil_da_lolze); espelho do repo.
create table if not exists public.app_funil_lolze (
  id         bigint generated always as identity primary key,
  evento     text not null check (evento in (
    'diagnostico_interagido','demo_mensagem','aplicacao_enviada',
    'cadastro_criado','checkout_iniciado','pagamento_confirmado','onboarding_concluido'
  )),
  dados      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_funil_lolze_evento
  on public.app_funil_lolze (evento, created_at desc);

alter table public.app_funil_lolze enable row level security;
-- sem policy: só service_role (painel do admin lê via server)
grant all on table public.app_funil_lolze to anon, authenticated, service_role;
