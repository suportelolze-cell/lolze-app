import { getCrmAdmin } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability/erros";
import { exchangeRefreshToken } from "@/lib/google/oauth";
import { janelaSync } from "./meta-core";
import {
  normalizarCustomerId,
  montarGaql,
  mapearLinhas,
  moedaDasLinhas,
  type GoogleAdsRow,
} from "./google-core";

/**
 * Ingestão do Google Ads → app_trafego (fonte 'google_ads'). SERVER-ONLY.
 * Espelha o meta-sync: janela curta, UPSERT idempotente por (tenant_id, dia,
 * fonte), guarda de moeda (só BRL), erro de auth → 'alta'.
 *
 * Diferenças do Meta: OAuth (refresh token com escopo `adwords` por tenant, no
 * app_tenant_secrets.google_ads_refresh_token) trocado por access token a cada
 * rodada; um DEVELOPER TOKEN de nível de app (GOOGLE_ADS_DEVELOPER_TOKEN); e um
 * customer id por tenant. Consulta GAQL via googleAds:searchStream.
 *
 * Feature DARK: só roda quando GOOGLE_ADS_INGEST_ENABLED=1 E o developer token
 * está configurado (ambos pré-requisitos de infra do Abner). Isolamento: toda
 * leitura/escrita filtra tenant_id (getCrmAdmin ignora RLS).
 */

const FONTE = "google_ads";
const MOEDA_SUPORTADA = "BRL";
const DIAS_JANELA = 3;
const TIMEOUT_MS = 20_000;

function apiVersion(): string {
  // As versões da Google Ads API são aposentadas ~13 meses após o lançamento.
  // GOOGLE_ADS_API_VERSION DEVE ser setado para uma versão suportada na ativação
  // (o default é só um fallback e envelhece). Ver os passos de ativação no PR.
  return (process.env.GOOGLE_ADS_API_VERSION || "v21").trim().replace(/^\/+|\/+$/g, "");
}

function hojeYMDSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Erro do Google que indica credencial/permissão quebrada (condição permanente). */
function ehErroDeAuth(msg: string): boolean {
  return /UNAUTHENTICATED|PERMISSION_DENIED|invalid_grant|developer token|authentication|\b401\b|\b403\b/i.test(
    msg
  );
}

type CredGoogle = { customerId: string; refreshToken: string };

type Insights = { rows: GoogleAdsRow[]; moeda: string | null };

/** Busca as métricas diárias da conta via googleAds:searchStream. */
async function buscarMetricas(
  cred: CredGoogle,
  accessToken: string,
  since: string,
  until: string
): Promise<Insights> {
  const url = `https://googleads.googleapis.com/${apiVersion()}/customers/${cred.customerId}/googleAds:searchStream`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim(),
    "content-type": "application/json",
  };
  // Contas sob uma manager account (MCC) exigem o login-customer-id (app-level).
  const mcc = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, "");
  if (mcc) headers["login-customer-id"] = mcc;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: montarGaql(since, until) }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    // searchStream devolve erro como ARRAY [{error:{...}}] (é streaming); o
    // gateway pode devolver como objeto {error:{...}}. Cobrimos os dois para não
    // perder a mensagem diagnóstica (ex.: "developer token not approved").
    const err = Array.isArray(json)
      ? (json[0] as { error?: { message?: string } } | undefined)?.error
      : (json as { error?: { message?: string } } | null)?.error;
    throw new Error(`Google Ads falhou: ${err?.message ?? `HTTP ${res.status}`}`);
  }
  // searchStream devolve um array de lotes, cada um com `results`.
  const batches = Array.isArray(json) ? (json as { results?: GoogleAdsRow[] }[]) : [];
  const rows = batches.flatMap((b) => b?.results ?? []);
  return { rows, moeda: moedaDasLinhas(rows) };
}

export type ResultadoSyncTenant = { ok: boolean; linhas: number; erro?: string };

/**
 * Sincroniza UM tenant. Loga o erro (contexto trafego.google.*) e devolve
 * {ok:false} — nunca lança (o cron chama vários em sequência).
 */
export async function sincronizarGoogleTenant(
  tenantId: string,
  opts?: { dias?: number; hojeYMD?: string }
): Promise<ResultadoSyncTenant> {
  const admin = getCrmAdmin();

  const { data } = await admin
    .from("app_tenant_secrets")
    .select("google_ads_customer_id,google_ads_refresh_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const rawId = ((data?.google_ads_customer_id as string | null) ?? "").trim();
  const rawToken = ((data?.google_ads_refresh_token as string | null) ?? "").trim();

  if (!rawId && !rawToken) return { ok: false, linhas: 0, erro: "não conectado" };

  const customerId = normalizarCustomerId(rawId);
  if (!customerId || !rawToken) {
    await registrarErro({
      tenantId,
      contexto: "trafego.google.config",
      erro: new Error("credenciais Google Ads inválidas (customer id ou refresh token malformado)"),
      severidade: "media",
    });
    return { ok: false, linhas: 0, erro: "credenciais Google Ads inválidas" };
  }
  const cred: CredGoogle = { customerId, refreshToken: rawToken };

  // try/catch: exchangeRefreshToken faz fetch e pode lançar (erro de rede) —
  // esta função NUNCA lança (o cron chama vários em sequência).
  let accessToken: string | null;
  try {
    accessToken = await exchangeRefreshToken(cred.refreshToken);
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    await registrarErro({
      tenantId,
      contexto: "trafego.google.auth",
      erro: new Error("não consegui trocar o refresh token do Google Ads (revogado/expirado?)"),
      severidade: "alta",
    });
    return { ok: false, linhas: 0, erro: "falha ao autenticar no Google" };
  }

  const hoje = opts?.hojeYMD ?? hojeYMDSaoPaulo();
  const { since, until } = janelaSync(hoje, opts?.dias ?? DIAS_JANELA);

  let insights: Insights;
  try {
    insights = await buscarMetricas(cred, accessToken, since, until);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await registrarErro({
      tenantId,
      contexto: "trafego.google.sync",
      erro: e,
      severidade: ehErroDeAuth(msg) ? "alta" : "media",
    });
    return { ok: false, linhas: 0, erro: msg };
  }

  if (insights.moeda && insights.moeda.toUpperCase() !== MOEDA_SUPORTADA) {
    await registrarErro({
      tenantId,
      contexto: "trafego.google.moeda",
      erro: new Error(`conta Google Ads em ${insights.moeda}; ingestão só suporta ${MOEDA_SUPORTADA}`),
      severidade: "media",
    });
    return { ok: false, linhas: 0, erro: `moeda ${insights.moeda} não suportada` };
  }

  const linhas = mapearLinhas(insights.rows);
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
    await registrarErro({ tenantId, contexto: "trafego.google.upsert", erro: error, severidade: "media" });
    return { ok: false, linhas: 0, erro: error.message };
  }
  return { ok: true, linhas: rows.length };
}

/**
 * Sincroniza TODOS os tenants com conexão Google Ads (chamado pelo cron).
 * Best-effort por tenant. Fica INERTE até GOOGLE_ADS_INGEST_ENABLED=1 e o
 * developer token estar configurado.
 */
export async function sincronizarGoogleTodos(): Promise<{ tenants: number; ok: number; linhas: number }> {
  const habilitado = (process.env.GOOGLE_ADS_INGEST_ENABLED || "").trim() === "1";
  const temDevToken = Boolean((process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim());
  if (!habilitado || !temDevToken) return { tenants: 0, ok: 0, linhas: 0 };

  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .not("google_ads_customer_id", "is", null)
    .not("google_ads_refresh_token", "is", null)
    .order("tenant_id", { ascending: true });

  const ids = (data ?? []).map((r) => r.tenant_id as string);
  let ok = 0;
  let linhas = 0;
  for (const tid of ids) {
    try {
      const r = await sincronizarGoogleTenant(tid);
      if (r.ok) {
        ok++;
        linhas += r.linhas;
      }
    } catch (e) {
      await registrarErro({ tenantId: tid, contexto: "trafego.google.sync", erro: e, severidade: "media" });
    }
  }
  return { tenants: ids.length, ok, linhas };
}
