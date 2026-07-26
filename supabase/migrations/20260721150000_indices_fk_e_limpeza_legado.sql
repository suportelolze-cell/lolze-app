-- Correções da análise profunda (21/07): performance + limpeza de schema legado.

-- 1) Índices de cobertura para as FKs sem índice (advisor Supabase de performance).
--    Melhora JOIN/CASCADE por lead quando houver volume. Aditivo e seguro.
create index if not exists idx_app_eventos_lead_id on public.app_eventos (lead_id);
create index if not exists idx_app_lead_canais_lead_id on public.app_lead_canais (lead_id);

-- 2) Remove tabelas LEGADAS do schema antigo: vazias (0 linhas), sem referência no
--    código, sem FK dependente — substituídas por app_eventos / app_stripe_eventos.
drop table if exists public.agent_events;
drop table if exists public.stripe_events;
