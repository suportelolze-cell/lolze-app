-- Modo de mensagem da Captação: além da abordagem escrita pela IA (prospecção
-- fria), o gestor pode escolher "Eu escrevo o texto" e mandar um DISPARO de
-- oferta com o próprio texto — reaproveitando a MESMA esteira segura (número
-- dedicado, volume/dia, espaçamento, dedup). Só muda quem redige a mensagem.
--
-- prospect_modo: 'ia' (atual, IA redige) | 'texto' (gestor redige o disparo).
-- prospect_mensagem: o texto do disparo quando modo='texto' (aceita os
--   placeholders {nome}/{empresa}/{cidade}/{nicho}, substituídos por prospect).
--
-- AINDA NÃO aplicada em produção (mandato §2 — decisão de Abner). O código lê/
-- escreve de forma DEFENSIVA: se estas colunas ainda não existem, cai para o
-- comportamento legado (modo 'ia') sem quebrar a Captação atual. Aplicar esta
-- migração ATIVA o modo de disparo por texto.
alter table public.app_config
  add column if not exists prospect_modo     text not null default 'ia',
  add column if not exists prospect_mensagem text;

alter table public.app_config
  drop constraint if exists app_config_prospect_modo_check;
alter table public.app_config
  add constraint app_config_prospect_modo_check check (prospect_modo in ('ia', 'texto'));
