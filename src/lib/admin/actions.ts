"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCrmServer } from "@/lib/supabase/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao, IMPERSONATE_COOKIE } from "@/lib/supabase/tenant";

async function exigirSuper() {
  const s = await getSessao();
  if (s.papel !== "superadmin") throw new Error("Acesso restrito.");
  return s;
}

export type ResultadoCriar = { ok: boolean; erro?: string; senha?: string; email?: string };

/** Gera um novo token de ingestão para o cliente (invalida o anterior). */
export async function regenerarToken(tenantId: string): Promise<string> {
  await exigirSuper();
  const novo =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const sb = getCrmServer();
  const { error } = await sb
    .from("app_tenant_secrets")
    .upsert(
      { tenant_id: tenantId, ingest_token: novo, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
  return novo;
}

/** Salva/atualiza os webhooks n8n por canal de um cliente. Somente superadmin. */
export async function salvarWebhooks(tenantId: string, urls: Record<string, string>) {
  await exigirSuper();
  const sb = getCrmServer();
  const rows = Object.entries(urls).map(([canal, url]) => ({
    tenant_id: tenantId,
    canal,
    url: (url ?? "").trim(),
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await sb
    .from("app_channel_webhooks")
    .upsert(rows, { onConflict: "tenant_id,canal" });
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
}

/** Salva a conexão Meta Ads do cliente. Token só é atualizado se enviado. */
export async function salvarMetaAdsCfg(
  tenantId: string,
  cfg: { adAccountId: string; accessToken: string }
) {
  await exigirSuper();
  const sb = getCrmServer();
  const patch: Record<string, unknown> = {
    tenant_id: tenantId,
    meta_ad_account_id: cfg.adAccountId.trim() || null,
    updated_at: new Date().toISOString(),
  };
  // Só sobrescreve o token se um novo foi digitado (campo vazio = manter atual).
  if (cfg.accessToken.trim()) patch.meta_access_token = cfg.accessToken.trim();
  const { error } = await sb.from("app_tenant_secrets").upsert(patch, { onConflict: "tenant_id" });
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
}

/** Salva a config da Evolution/WhatsApp do cliente. Somente superadmin. */
export async function salvarEvolutionCfg(
  tenantId: string,
  cfg: { instance: string; n8nInbound: string }
) {
  await exigirSuper();
  const sb = getCrmServer();
  const { error } = await sb.from("app_tenant_secrets").upsert(
    {
      tenant_id: tenantId,
      evolution_instance: cfg.instance.trim() || null,
      n8n_inbound_url: cfg.n8nInbound.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
}

/** Salva a persona/cérebro do SDR de um cliente. Somente superadmin. */
export async function salvarPersona(
  tenantId: string,
  p: {
    oferta: string;
    publico: string;
    tom: string;
    objecoes: string;
    faq: string;
    regras: string;
    agenteAtivo: boolean;
  }
) {
  await exigirSuper();
  const sb = getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({
      oferta: p.oferta,
      publico: p.publico,
      tom: p.tom,
      objecoes: p.objecoes,
      faq: p.faq,
      regras: p.regras,
      agente_ativo: p.agenteAtivo,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
}

/**
 * Cadastra um cliente novo: cria o tenant, o usuário de auth (owner),
 * o perfil e a configuração inicial. Requer service_role do CRM.
 */
export async function criarCliente(form: {
  nomeNegocio: string;
  plano: string;
  emailDono: string;
  nomeDono: string;
  senha: string;
  telefone?: string;
  canais?: string[];
  webhooks?: Record<string, string>;
}): Promise<ResultadoCriar> {
  await exigirSuper();

  const nomeNegocio = form.nomeNegocio.trim();
  const emailDono = form.emailDono.trim().toLowerCase();
  if (!nomeNegocio) return { ok: false, erro: "Informe o nome do negócio." };
  if (!emailDono) return { ok: false, erro: "Informe o e-mail do dono." };
  if (!form.senha || form.senha.length < 6)
    return { ok: false, erro: "A senha precisa ter ao menos 6 caracteres." };

  let admin;
  try {
    admin = getCrmAdmin();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  const slug =
    nomeNegocio
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 6);

  // 1. Tenant
  const { data: tenant, error: errT } = await admin
    .from("app_tenants")
    .insert({
      nome: nomeNegocio,
      slug,
      plano: form.plano,
      status: "ativo",
      canais: form.canais ?? [],
      contato_email: emailDono,
      contato_telefone: form.telefone ?? null,
    })
    .select("id")
    .single();
  if (errT || !tenant) return { ok: false, erro: errT?.message ?? "Falha ao criar tenant." };

  // 2. Usuário de auth (owner)
  const { data: u, error: errU } = await admin.auth.admin.createUser({
    email: emailDono,
    password: form.senha,
    email_confirm: true,
  });
  if (errU || !u?.user) {
    // limpa o tenant órfão
    await admin.from("app_tenants").delete().eq("id", tenant.id);
    return { ok: false, erro: errU?.message ?? "Falha ao criar usuário." };
  }

  // 3. Perfil + 4. Config
  await admin.from("app_profiles").insert({
    id: u.user.id,
    nome: form.nomeDono.trim() || nomeNegocio,
    email: emailDono,
    papel: "owner",
    tenant_id: tenant.id,
  });
  await admin.from("app_config").insert({
    id: tenant.id,
    tenant_id: tenant.id,
    nome_negocio: nomeNegocio,
    email: emailDono,
  });

  // 5. Token de ingestão (entrada n8n) — gerado pelo default da tabela
  await admin.from("app_tenant_secrets").insert({ tenant_id: tenant.id });

  // 6. Webhooks n8n por canal (se informados)
  if (form.webhooks) {
    const rows = Object.entries(form.webhooks)
      .filter(([, url]) => (url ?? "").trim())
      .map(([canal, url]) => ({ tenant_id: tenant.id, canal, url: url.trim() }));
    if (rows.length) await admin.from("app_channel_webhooks").insert(rows);
  }

  revalidatePath("/admin");
  return { ok: true, email: emailDono, senha: form.senha };
}

/** Atualiza plano / status / dados do cliente. */
export async function atualizarCliente(
  id: string,
  campos: {
    nome?: string;
    plano?: string;
    status?: string;
    canais?: string[];
    contatoEmail?: string;
    contatoTelefone?: string;
    observacoes?: string;
  }
) {
  await exigirSuper();
  const sb = getCrmServer();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (campos.nome !== undefined) patch.nome = campos.nome;
  if (campos.plano !== undefined) patch.plano = campos.plano;
  if (campos.status !== undefined) patch.status = campos.status;
  if (campos.canais !== undefined) patch.canais = campos.canais;
  if (campos.contatoEmail !== undefined) patch.contato_email = campos.contatoEmail;
  if (campos.contatoTelefone !== undefined) patch.contato_telefone = campos.contatoTelefone;
  if (campos.observacoes !== undefined) patch.observacoes = campos.observacoes;

  const { error } = await sb.from("app_tenants").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
  revalidatePath(`/admin/clientes/${id}`);
}

/** Superadmin passa a "ver como" um cliente. */
export async function entrarComo(tenantId: string) {
  await exigirSuper();
  cookies().set(IMPERSONATE_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/painel");
}

/** Sai do modo "ver como" e volta ao admin. */
export async function sairImpersonacao() {
  cookies().delete(IMPERSONATE_COOKIE);
  redirect("/admin");
}
