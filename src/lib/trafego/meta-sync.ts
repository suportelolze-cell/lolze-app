import { getCrmAdmin } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability/erros";
import { mapearInsights, normalizarAdAccountId, janelaSync, type MetaInsight } from "./meta-core";

/**
 * Ingestão do Meta Ads → app_trafego (fonte 'meta_ads'). SERVER-ONLY.
 *
 * Um token por tenant (app_tenant_secrets.meta_access_token) com permissão de
 * leitura de anúncios (ads_read). Buscamos os insights diários da conta
 * (level=account, time_increment=1) numa janela curta e fazemos UPSERT
 * idempotente por (tenant_id, dia, fonte) — reprocessar o mesmo dia sobrescreve
 * (o Meta revisa gasto/conversões retroativamente).
 *
 * Depois de sincronizar, o painel (investimento/CPA) e o Raio-X do Funil (topo
 * do funil) passam a mostrar números reais automaticamente — os dois já leem
 * app_trafego; só faltava alguém escrevendo.
 *
 * Isolamento: getCrmAdmin() ignora RLS, então TODA leitura/escrita é filtrada
 * por tenant_id explicitamente (o cron varre vários tenants, cada um isolado).
 *
 * Ativação (feature ships "dark"): o cron só sincroniza quando
 * META_INGEST_ENABLED=1. Sequência segura (evita flood de app_erros por upsert
 * sem o índice único): (1) aplicar a migração 20260803120000, (2) ligar a env,
 * (3) conectar a conta no MetaAdsForm com um token ads_read.
 *
 * Escopo assumido: contas em BRL (mercado-alvo). Conta em outra moeda é PULADA
 * e reportada — não gravamos um "R$" que na verdade é dólar (métrica financeira
 * enganosa). Fuso: a janela usa America/Sao_Paulo; contas geridas em outro fuso
 * podem ter o dia corrente defasado em ~1 dia (auto-corrige pela janela de 3
 * dias). Aceitável para o alvo BR; revisitar se entrar conta internacional.
 */

const FONTE = "meta_ads";
const MOEDA_SUPORTADA = "BRL";
const DIAS_JANELA = 3; // reprocessa os últimos 3 dias (absorve revisão retroativa do Meta)
const MAX_PAGINAS = 20; // teto de paginação (guarda contra loop infinito)
const TIMEOUT_MS = 15_000; // aborta um fetch travado (1 conta lenta não segura o lote)

function graphBase(): string {
  const v = (process.env.META_GRAPH_API_VERSION || "v21.0").trim().replace(/^\/+|\/+$/g, "");
  return `https://graph.facebook.com/${v}`;
}

function hojeYMDSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Erro do Meta que indica credencial/permissão quebrada (condição permanente). */
function ehErroDeAuth(msg: string): boolean {
  return /OAuthException|access token|Error validating|permission|\bcode 190\b|\bcode 102\b|\bcode 10\b|\bcode 200\b/i.test(
    msg
  );
}

type CredMeta = { adAccountId: string; token: string };

/** Resultado das insights + a moeda observada da conta (para a guarda de moeda). */
type Insights = { rows: MetaInsight[]; moeda: string | null };

/** Busca os insights da janela, seguindo a paginação da Graph API. */
async function buscarInsights(cred: CredMeta, since: string, until: string): Promise<Insights> {
  const params = new URLSearchParams({
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "spend,inline_link_clicks,actions,account_currency",
    limit: "500",
  });
  // Token vai no cabeçalho Authorization (fora da URL): a URL que construímos
  // nunca carrega o segredo, então nada que venha a logar URLs de saída expõe
  // o token de longa duração do tenant.
  const headers = { Authorization: `Bearer ${cred.token}` };
  let url: string | null = `${graphBase()}/${cred.adAccountId}/insights?${params.toString()}`;
  const rows: MetaInsight[] = [];
  let moeda: string | null = null;

  for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    const json = (await res.json().catch(() => null)) as {
      data?: MetaInsight[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    } | null;
    if (!res.ok || !json || json.error) {
      const err = json?.error;
      throw new Error(
        `Meta insights falhou${err?.code ? ` (code ${err.code})` : ""}: ${err?.message ?? `HTTP ${res.status}`}`
      );
    }
    for (const r of json.data ?? []) {
      rows.push(r);
      if (!moeda && r.account_currency) moeda = r.account_currency;
    }
    url = json.paging?.next ?? null; // raro (janela de 3 dias, level=account)
  }
  return { rows, moeda };
}

export type ResultadoSyncTenant = { ok: boolean; linhas: number; erro?: string };

/**
 * Sincroniza UM tenant. Loga o erro (contexto trafego.meta.*) e devolve
 * {ok:false} — nunca lança (o cron chama vários em sequência).
 */
export async function sincronizarMetaTenant(
  tenantId: string,
  opts?: { dias?: number; hojeYMD?: string }
): Promise<ResultadoSyncTenant> {
  const admin = getCrmAdmin();

  const { data } = await admin
    .from("app_tenant_secrets")
    .select("meta_ad_account_id,meta_access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const rawId = ((data?.meta_ad_account_id as string | null) ?? "").trim();
  const rawToken = ((data?.meta_access_token as string | null) ?? "").trim();

  // Sem NENHUMA credencial: tenant não conectou — silêncio (não é erro).
  if (!rawId && !rawToken) return { ok: false, linhas: 0, erro: "não conectado" };

  // Credencial PRESENTE mas malformada (id não-numérico, token só espaço): é
  // misconfiguração do operador — reporta (senão a conexão quebrada some).
  const adAccountId = normalizarAdAccountId(rawId);
  if (!adAccountId || !rawToken) {
    await registrarErro({
      tenantId,
      contexto: "trafego.meta.config",
      erro: new Error("credenciais Meta inválidas (ad account id ou token malformado)"),
      severidade: "media",
    });
    return { ok: false, linhas: 0, erro: "credenciais Meta inválidas" };
  }
  const cred: CredMeta = { adAccountId, token: rawToken };

  const hoje = opts?.hojeYMD ?? hojeYMDSaoPaulo();
  const { since, until } = janelaSync(hoje, opts?.dias ?? DIAS_JANELA);

  let insights: Insights;
  try {
    insights = await buscarInsights(cred, since, until);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    // Falha de auth (token expirado/permissão revogada) é PERMANENTE → 'alta'
    // para o operador ser alertado; transiente (timeout/HTTP) fica em 'media'.
    await registrarErro({
      tenantId,
      contexto: "trafego.meta.sync",
      erro: e,
      severidade: ehErroDeAuth(msg) ? "alta" : "media",
    });
    return { ok: false, linhas: 0, erro: msg };
  }

  // Guarda de moeda: só ingerimos BRL (o app exibe R$). Conta em outra moeda
  // gravaria um número financeiro enganoso — pula e reporta.
  if (insights.moeda && insights.moeda.toUpperCase() !== MOEDA_SUPORTADA) {
    await registrarErro({
      tenantId,
      contexto: "trafego.meta.moeda",
      erro: new Error(`conta Meta em ${insights.moeda}; ingestão só suporta ${MOEDA_SUPORTADA}`),
      severidade: "media",
    });
    return { ok: false, linhas: 0, erro: `moeda ${insights.moeda} não suportada` };
  }

  const linhas = mapearInsights(insights.rows);
  if (linhas.length === 0) return { ok: true, linhas: 0 };

  const rows = linhas.map((l) => ({
    tenant_id: tenantId,
    dia: l.dia,
    fonte: FONTE,
    cliques: l.cliques,
    investimento_cents: l.investimentoCents,
    visitantes: l.visitantes,
  }));

  const { error } = await admin.from("app_trafego").upsert(rows, { onConflict: "tenant_id,dia,fonte" });
  if (error) {
    await registrarErro({ tenantId, contexto: "trafego.meta.upsert", erro: error, severidade: "media" });
    return { ok: false, linhas: 0, erro: error.message };
  }
  return { ok: true, linhas: rows.length };
}

/**
 * Sincroniza TODOS os tenants com conexão Meta configurada (chamado pelo cron).
 * Best-effort por tenant — um erro não derruba o lote. Fica INERTE até
 * META_INGEST_ENABLED=1 (deploy dark; ver o cabeçalho deste arquivo).
 */
export async function sincronizarMetaTodos(): Promise<{ tenants: number; ok: number; linhas: number }> {
  if ((process.env.META_INGEST_ENABLED || "").trim() !== "1") {
    return { tenants: 0, ok: 0, linhas: 0 };
  }

  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .not("meta_ad_account_id", "is", null)
    .not("meta_access_token", "is", null)
    .order("tenant_id", { ascending: true }); // ordem determinística (não a física do heap)

  const ids = (data ?? []).map((r) => r.tenant_id as string);
  let ok = 0;
  let linhas = 0;
  for (const tid of ids) {
    try {
      const r = await sincronizarMetaTenant(tid);
      if (r.ok) {
        ok++;
        linhas += r.linhas;
      }
    } catch (e) {
      await registrarErro({ tenantId: tid, contexto: "trafego.meta.sync", erro: e, severidade: "media" });
    }
  }
  return { tenants: ids.length, ok, linhas };
}
