-- Upsert idempotente da ingestão de tráfego (Meta Ads → app_trafego).
--
-- app_trafego só tinha PK em `id` (identity). Sem uma chave única por
-- (tenant_id, dia, fonte), cada rodada do cron de sincronização INSERIRIA
-- linhas novas para o mesmo dia — duplicando gasto/cliques no painel e no
-- Raio-X do Funil. Este índice único é o alvo do ON CONFLICT do upsert em
-- src/lib/trafego/meta-sync.ts, tornando "resincronizar o mesmo dia" uma
-- operação que SOBRESCREVE (o Meta revisa gasto/conversões retroativamente).
--
-- AINDA NÃO aplicado em produção (depende da autorização de Abner — mandato §2).
-- Enquanto não aplicado, o upsert falha fechado (erro logado, nada é gravado):
-- nenhum dado é corrompido, apenas a ingestão não popula até a migração rodar.
--
-- app_trafego não tem writer hoje (tabela vazia), então criar o índice único é
-- instantâneo e não conflita com dados existentes.
create unique index if not exists app_trafego_tenant_dia_fonte_uk
  on public.app_trafego (tenant_id, dia, fonte);
