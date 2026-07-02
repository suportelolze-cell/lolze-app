"use server";

import { revalidatePath } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { gerarAbordagem } from "./enviar";
import { conectarDisparo, statusDisparo, desconectarDisparo, nomeDisparo } from "@/lib/evolution/client";

const ehGestor = (p: string) => p === "owner" || p === "superadmin";

type Admin = ReturnType<typeof getCrmAdmin>;

/** Limite de números de captação do tenant = nº de SDRs do plano (sdr_max). */
async function limiteCaptacao(admin: Admin, tenantId: string): Promise<number> {
  const { data: t } = await admin.from("app_tenants").select("plano").eq("id", tenantId).maybeSingle();
  const { data: p } = await admin
    .from("app_plans")
    .select("sdr_max")
    .eq("id", (t?.plano as string) ?? "")
    .maybeSingle();
  return Number(p?.sdr_max ?? 0);
}

async function lerPool(admin: Admin, tenantId: string): Promise<string[]> {
  const { data } = await admin
    .from("app_config")
    .select("prospect_instancias")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Array.isArray(data?.prospect_instancias) ? (data!.prospect_instancias as string[]).map(String) : [];
}

/** Cliente conecta um NOVO número de captação (via QR). Respeita o limite do plano. */
export async function conectarNumeroCaptacao(): Promise<{
  ok: boolean;
  qr?: string | null;
  conectado?: boolean;
  instancia?: string;
  erro?: string;
}> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();

  const max = await limiteCaptacao(admin, s.tenantId);
  if (max <= 0) return { ok: false, erro: "Seu plano não inclui números de captação." };
  const pool = await lerPool(admin, s.tenantId);
  if (pool.length >= max) return { ok: false, erro: `Limite do plano atingido (${max} número(s)).` };

  let nome = "";
  for (let i = 1; i <= max; i++) {
    const n = nomeDisparo(s.tenantId, i);
    if (!pool.includes(n)) {
      nome = n;
      break;
    }
  }
  if (!nome) return { ok: false, erro: "Sem vaga disponível." };

  const r = await conectarDisparo(s.tenantId, nome);
  if (!r.ok) return { ok: false, erro: r.erro ?? "Falha ao conectar." };

  await admin
    .from("app_config")
    .update({ prospect_instancias: [...pool, nome], updated_at: new Date().toISOString() })
    .eq("tenant_id", s.tenantId);
  revalidatePath("/configuracoes");
  return { ok: true, qr: r.qr ?? null, conectado: r.conectado, instancia: nome };
}

/** Estado de conexão de um número de captação (polling). */
export async function statusNumeroCaptacao(
  instancia: string
): Promise<{ ok: boolean; conectado: boolean; numero?: string | null }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, conectado: false };
  return statusDisparo(instancia);
}

/** Remove/desconecta um número de captação. */
export async function removerNumeroCaptacao(instancia: string): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  await desconectarDisparo(instancia).catch(() => null);

  const { data } = await admin
    .from("app_config")
    .select("prospect_instancias,prospect_instancia")
    .eq("tenant_id", s.tenantId)
    .maybeSingle();
  const pool = (Array.isArray(data?.prospect_instancias) ? (data!.prospect_instancias as string[]).map(String) : []).filter(
    (n) => n !== instancia
  );
  const patch: Record<string, unknown> = { prospect_instancias: pool, updated_at: new Date().toISOString() };
  if ((data?.prospect_instancia ?? "") === instancia) patch.prospect_instancia = null;
  await admin.from("app_config").update(patch).eq("tenant_id", s.tenantId);
  revalidatePath("/configuracoes");
  revalidatePath("/captacao");
  return { ok: true };
}

/** Normaliza telefone para só dígitos, com DDI 55 se faltar. */
function normalizarTel(s: string): string {
  const d = (s || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.length <= 11 ? "55" + d : d;
}

type LinhaCsv = { nome: string | null; telefone: string; site: string | null; nicho: string | null; cidade: string | null };

/** Parser de CSV simples (detecta ; ou , ; cabeçalho flexível). */
function parseCsv(texto: string): LinhaCsv[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const delim = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = linhas[0].split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idx = (nomes: string[]) => head.findIndex((h) => nomes.some((n) => h.includes(n)));
  const iNome = idx(["nome", "empresa", "name", "title"]);
  const iTel = idx(["telefone", "phone", "whatsapp", "celular", "fone", "tel"]);
  const iSite = idx(["site", "website", "url"]);
  const iNicho = idx(["nicho", "segmento", "categoria", "category", "tipo"]);
  const iCidade = idx(["cidade", "city", "municipio", "município"]);

  const val = (cols: string[], i: number) => (i >= 0 ? (cols[i] || "").trim().replace(/^"|"$/g, "") : "");
  const out: LinhaCsv[] = [];
  for (const l of linhas.slice(1)) {
    const cols = l.split(delim);
    const tel = normalizarTel(val(cols, iTel));
    if (!tel) continue;
    out.push({
      nome: val(cols, iNome) || null,
      telefone: tel,
      site: val(cols, iSite) || null,
      nicho: val(cols, iNicho) || null,
      cidade: val(cols, iCidade) || null,
    });
  }
  return out;
}

/** Importa uma planilha (CSV colado ou de arquivo) de prospects. */
export async function importarProspectsCsv(
  texto: string
): Promise<{ ok: boolean; inseridos?: number; lidos?: number; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const linhas = parseCsv(texto).slice(0, 3000); // teto de segurança
  if (linhas.length === 0) return { ok: false, erro: "Não encontrei linhas com telefone válido no arquivo." };

  const admin = getCrmAdmin();
  const rows = linhas.map((l) => ({
    tenant_id: s.tenantId,
    nome_empresa: l.nome,
    telefone: l.telefone,
    site: l.site,
    nicho: l.nicho,
    cidade: l.cidade,
    status: "novo",
  }));

  let inseridos = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data } = await admin
      .from("app_prospects")
      .upsert(chunk, { onConflict: "tenant_id,telefone", ignoreDuplicates: true })
      .select("id");
    inseridos += (data ?? []).length;
  }

  revalidatePath("/captacao");
  return { ok: true, inseridos, lidos: linhas.length };
}

/** Salva a config de captação (número dedicado, volume/dia, liga/desliga). */
export async function setCaptacaoCfg(input: {
  instancia: string;
  porDia: number;
  ativo: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const porDia = Math.min(Math.max(Math.round(Number(input.porDia) || 10), 1), 40);
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_config")
    .update({
      prospect_instancia: input.instancia.trim() || null,
      prospect_dia: porDia,
      prospect_ativo: Boolean(input.ativo),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/captacao");
  return { ok: true };
}

/** Descarta um prospect (não será mais enviado). */
export async function descartarProspect(id: number): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_prospects")
    .update({ status: "descartado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/captacao");
  return { ok: true };
}

/** Gera uma PRÉVIA de abordagem (sem enviar) — pra ver o estilo antes de ligar. */
export async function gerarPrevia(): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const [{ data: cfg }, { data: p }] = await Promise.all([
    admin.from("app_config").select("tenant_id,nome_negocio,oferta,tom").eq("tenant_id", s.tenantId).maybeSingle(),
    admin
      .from("app_prospects")
      .select("id,nome_empresa,telefone,site,nicho,cidade")
      .eq("tenant_id", s.tenantId)
      .eq("status", "novo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!p) return { ok: false, erro: "Importe uma lista primeiro (nenhum prospect novo)." };
  try {
    const mensagem = await gerarAbordagem(
      {
        tenant_id: s.tenantId,
        prospect_instancia: null,
        prospect_dia: null,
        nome_negocio: (cfg?.nome_negocio as string | null) ?? null,
        oferta: (cfg?.oferta as string | null) ?? null,
        tom: (cfg?.tom as string | null) ?? null,
      },
      p as { id: number; nome_empresa: string | null; telefone: string; site: string | null; nicho: string | null; cidade: string | null }
    );
    return { ok: true, mensagem };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
