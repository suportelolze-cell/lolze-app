-- Régua de qualificação por cliente/nicho (T5): texto livre onde o admin define
-- o que torna um lead quente/morno/frio NAQUELE negócio (ex.: "quente = fatura
-- acima de R$50k/mês"). O SDR passa a classificar a temperatura combinando este
-- critério com o contexto da conversa (antes era só julgamento geral).
--
-- Coluna aditiva/nullable. AINDA NÃO aplicada em produção (mandato §2). O código
-- lê/escreve de forma DEFENSIVA: sem a coluna, o carregamento da persona do SDR
-- (caminho crítico, roda a cada mensagem) cai para o comportamento atual sem
-- quebrar; a régua fica vazia até a migração rodar.
alter table public.app_config
  add column if not exists regua_qualificacao text;
