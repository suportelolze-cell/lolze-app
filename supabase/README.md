# Migrações do Supabase — Lolze (projeto CRM "SaaS Lolze")

Projeto: **SaaS Lolze** (CRM) — ref `pphstbiwcaeldaoesuwl`, Postgres 17.

## Arquivos

| Arquivo | O que é |
|---|---|
| `migrations/20260524020000_baseline_app_schema.sql` | **Baseline do app.** Retrato fiel do schema `app_*` (18 tabelas, PK/UNIQUE/CHECK, FKs, 27 índices incl. HNSW, 5 funções, 1 trigger, RLS + 12 policies, grants). |
| `migrations/20260524020001_baseline_legacy_v1.sql` | **Baseline do legado.** 21 tabelas v1 + `audit_*`, funções (`is_admin`, `current_client_id`, `dashboard_metrics`, `rag_search`...), 3 views `v_*`, RLS/policies e grants. Não usado pelo app atual; existe só para reprodução 100% do banco. |
| `migrations/20260719015109_add_app_agent_runs_observability.sql` | Cria `app_agent_runs` (usada por `src/lib/agent/runs.ts`). **Já aplicada em produção** em 2026-07-19 (consta no ledger). |

Todos os três foram **validados**: o DDL roda limpo num Postgres 17 (testado em schemas temporários isolados, com `ROLLBACK` — produção não foi tocada nesse teste).

## Convenção RLS do app (`app_*`)

`superadmin OU dono do tenant`, via `public.app_is_superadmin()` + `public.app_current_tenant()`.
Tabelas de bastidor (`app_erros`, `app_uso_ia`, `app_rate_hits`, `app_prospects`,
`app_ideias`/`comentarios`/`likes`) ficam com **RLS ligado e sem policy** — acesso só pelo
`service_role` (server actions). Isso gera avisos `rls_enabled_no_policy` (INFO) no linter,
que são **intencionais**.

## Como adotar (projeto que JÁ existe em produção)

O banco de produção já tem todo o schema (`app_*` + legado + `app_agent_runs`). Portanto
**NÃO reaplique os baselines em produção** — apenas registre-os como "já aplicados":

```bash
supabase link --project-ref pphstbiwcaeldaoesuwl
supabase migration repair --status applied 20260524020000   # baseline do app
supabase migration repair --status applied 20260524020001   # baseline do legado
# 20260719015109 já está no ledger remoto (foi aplicada de verdade); nada a fazer.
supabase db push   # deve ficar "no changes"
```

## Como reproduzir do zero (dev local / novo ambiente)

```bash
supabase db reset
```

Ordem de execução (por timestamp): baseline do app → baseline do legado →
`add_app_agent_runs_observability`. Recria todo o banco.

## Daqui pra frente

Toda mudança de schema vira um arquivo novo (`supabase migration new <nome>`), com
timestamp maior — para o schema ficar versionado e revisável (o que faltava).

## Nota de segurança

O `.env.local` contém segredos reais em texto (service_role do CRM, OpenAI, Anthropic,
Google client secret). Está no `.gitignore` (não commitado) — mantenha assim.
