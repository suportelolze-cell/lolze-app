# CLAUDE.md — lolze-app

App Next.js 14 (App Router) + Supabase multi-tenant: SDR de IA (Claude) que atende
leads por WhatsApp/Instagram, qualifica, agenda e faz handoff para humanos, com CRM,
agenda e painel por cliente (tenant).

## Regras de trabalho (mandato do projeto)

1. **Prioridade:** confiabilidade → cobrança → dados/métricas → ativação. Novos módulos
   e novos canais só depois disso. Corrigir **um fluxo por vez**.
2. **Nunca alterar produção, segredos, banco de produção ou cobrança sem autorização
   explícita de Abner.** Trabalho vai em branch + PR; merge é decisão dele.
3. Não apresentar como disponível um recurso/canal que não passou por teste ponta a ponta.
4. Nada de prova social artificial, métricas simuladas sem rótulo ou promessas absolutas.
5. Toda correção crítica ganha teste de regressão.
6. Direção do produto: central comercial multicanal, "um cliente, uma memória",
   ROI verificável por eventos. Implantação é configuração padronizada, não projeto sob medida.

O contexto estratégico completo (diagnóstico, preços, roadmap P0/P1/P2, critérios de
aceite) vive **fora deste repositório** (é público), nos arquivos privados do workspace:
`DOSSIE-ESTRATEGICO-OPERACIONAL.md` e `ROADMAP-EXECUCAO.md` na pasta pai do projeto.
Consulte-os antes de propor mudanças; revalide o estado real (repo, Vercel, Supabase)
antes de executar.

## Convenções técnicas

- **Banco:** projeto Supabase "SaaS Lolze" (CRM). Tabelas do app usam prefixo `app_*`
  com isolamento por `tenant_id` + RLS (`app_is_superadmin()` / `app_current_tenant()`).
  Schema versionado em `supabase/migrations/` (ver `supabase/README.md`); toda mudança
  de schema é uma migração nova (`supabase migration new <nome>`), nunca edição do baseline.
- **Segredos:** somente server-side (`SUPABASE_CRM_SERVICE_KEY`, `ANTHROPIC_API_KEY`, ...);
  nunca com prefixo `NEXT_PUBLIC_`. `.env*.local` não é commitado.
- **IA:** cérebro do SDR em `src/lib/agent/` (Anthropic SDK; server-only). Respeitar
  guardrails existentes: handoff humano cala a IA, teto de custo por plano, observabilidade
  em `app_agent_runs`/`app_erros`/`app_uso_ia`.
- **Webhooks:** validar autenticação/assinatura em toda entrada externa; responder rápido;
  tratar retentativas de provedor com idempotência (nunca confiar que chegam uma vez só).
- **Erros:** não engolir exceções silenciosamente em fluxo de negócio — registrar via
  `src/lib/observability/erros.ts` e dar visibilidade ao operador.
- **Idioma:** código, commits e UI em pt-BR (padrão existente do repo).
- **Deploy:** Vercel a partir da `main`. Não commitar direto na `main`; branch + PR.
