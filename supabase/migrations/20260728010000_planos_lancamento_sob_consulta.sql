-- Estrutura de planos Básico/Pro/Advanced: oferta de lançamento + sob consulta.

alter table public.app_plans
  add column if not exists setup_cents_de integer,
  add column if not exists sob_consulta boolean not null default false;

comment on column public.app_plans.setup_cents_de is
  'Preço OFICIAL da implantação (riscado no card). NULL ou <= setup_cents = sem oferta de lançamento. O valor COBRADO é sempre setup_cents.';
comment on column public.app_plans.sob_consulta is
  'Advanced: mostra "a partir de {mensal}" + CTA "Falar com a gente" em vez de checkout direto.';
