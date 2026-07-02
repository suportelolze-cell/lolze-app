"use server";

import { revalidatePath } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { gerarAbordagem } from "./enviar";

const ehGestor = (p: string) => p === "owner" || p === "superadmin";

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
