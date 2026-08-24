-- Playbook por tenant (Decisão de arquitetura nº 1 do pivô p/ infoproduto).
-- Cada tenant escolhe o tipo de operação: 'servico_local' (padrão, comportamento
-- atual) ou 'infoproduto'. O mesmo motor do SDR troca o fluxo (prompt) conforme
-- o playbook. Aditiva e segura: default 'servico_local' preserva todo mundo.

alter table public.app_config
  add column if not exists playbook text not null default 'servico_local';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_config_playbook_check') then
    alter table public.app_config
      add constraint app_config_playbook_check check (playbook in ('servico_local', 'infoproduto'));
  end if;
end $$;
