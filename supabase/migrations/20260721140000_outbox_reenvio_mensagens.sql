-- Outbox / reenvio assíncrono de mensagens de saída que falharam.
--
-- dispatchOutbound já retenta DENTRO do request e, no fim, marca a mensagem como
-- 'falhou'. Faltava o retry AO LONGO DO TEMPO: se o canal caiu por minutos/horas,
-- a mensagem ficava 'falhou' para sempre. Estas colunas dão suporte a um cron que
-- reenvia com backoff e, esgotadas as tentativas, marca 'morta' (dead-letter).
--
-- Aditivo e seguro: colunas com default; nenhuma linha existente muda de
-- comportamento (reenvios=0). Só mensagens autor='ia' com status='falhou' entram
-- na fila de reenvio.

alter table public.app_mensagens
  add column if not exists reenvios integer not null default 0,
  add column if not exists proxima_tentativa timestamptz;

-- Índice parcial para o cron achar rápido o que reenviar (poucas linhas 'falhou').
create index if not exists idx_app_mensagens_reenvio
  on public.app_mensagens (proxima_tentativa)
  where status = 'falhou' and autor = 'ia';

comment on column public.app_mensagens.reenvios is
  'Reenvios assíncronos já tentados pelo cron (além das tentativas dentro do request). Esgotado => status morta (dead-letter).';
comment on column public.app_mensagens.proxima_tentativa is
  'Quando o cron pode tentar reenviar de novo (backoff). NULL = elegível no próximo ciclo.';
