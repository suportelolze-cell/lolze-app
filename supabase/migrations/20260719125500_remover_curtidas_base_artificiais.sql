-- Remove a prova social artificial do mural de ideias (dossiê, seções 4.5/11):
-- as curtidas exibidas passam a ser somente as reais (app_ideia_likes).
-- Aplicada em produção via ledger em 2026-07-19 (nome: remover_curtidas_base_artificiais).
alter table public.app_ideias drop column if exists curtidas_base;
