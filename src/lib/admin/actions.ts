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

/** Salva a conexão Instagram do cliente. Token só é atualizado se enviado. */
export async function salvarInstagramCfg(
  tenantId: string,
  cfg: { igAccountId: string; accessToken: string }
) {
  await exigirSuper();
  const sb = getCrmServer();
  const patch: Record<string, unknown> = {
    tenant_id: tenantId,
    ig_account_id: cfg.igAccountId.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (cfg.accessToken.trim()) patch.ig_access_token = cfg.accessToken.trim();
  const { error } = await sb.from("app_tenant_secrets").upsert(patch, { onConflict: "tenant_id" });
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

/** Salva o nome da instância Evolution do cliente. Somente superadmin. */
export async function salvarEvolutionCfg(tenantId: string, cfg: { instance: string }) {
  await exigirSuper();
  const sb = getCrmServer();
  const { error } = await sb.from("app_tenant_secrets").upsert(
    {
      tenant_id: tenantId,
      evolution_instance: cfg.instance.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
  if (error) throw error;
  revalidatePath(`/admin/clientes/${tenantId}`);
}

/**
 * Salva o pool de números de disparo (prospecção) do cliente. Somente
 * superadmin. Respeita o limite do plano (app_plans.max_disparo).
 */
export async function salvarDisparoInstancias(
  tenantId: string,
  instancias: string[]
): Promise<{ ok: boolean; erro?: string }> {
  await exigirSuper();
  const sb = getCrmServer();

  // Limite do plano do cliente.
  const { data: t } = await sb.from("app_tenants").select("plano").eq("id", tenantId).maybeSingle();
  const { data: plano } = await sb
    .from("app_plans")
    .select("max_disparo")
    .eq("id", (t?.plano as string) ?? "")
    .maybeSingle();
  const max = Number(plano?.max_disparo ?? 1);

  // Normaliza: trim, remove vazios/duplicados, corta no limite do plano.
  const limpo = Array.from(
    new Set(instancias.map((s) => String(s).trim()).filter(Boolean))
  ).slice(0, max);

  const { error } = await sb
    .from("app_config")
    .update({ prospect_instancias: limpo, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/clientes/${tenantId}`);
  return { ok: true };
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

  // 5. Token de integração (usado internamente pelo webhook do app) — default da tabela
  await admin.from("app_tenant_secrets").insert({ tenant_id: tenant.id });

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

/**
 * Troca o e-mail de ACESSO (login) do dono do cliente. Atualiza o Auth
 * (fonte de verdade) e espelha em app_profiles / app_config. Usado quando o
 * cliente perdeu o e-mail antigo mas quer manter a mesma conta.
 */
export async function alterarEmailAcesso(
  tenantId: string,
  novoEmail: string
): Promise<{ ok: boolean; erro?: string }> {
  await exigirSuper();
  const email = novoEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };

  const admin = getCrmAdmin();
  const { data: dono } = await admin
    .from("app_profiles")
    .select("id,email")
    .eq("tenant_id", tenantId)
    .eq("papel", "owner")
    .limit(1)
    .maybeSingle();
  if (!dono?.id) return { ok: false, erro: "Este cliente não tem um usuário dono cadastrado." };
  if ((dono.email ?? "").toLowerCase() === email)
    return { ok: false, erro: "Esse já é o e-mail de acesso atual." };

  // 1. Auth = fonte de verdade do login. email_confirm: já válido sem precisar
  //    confirmar no e-mail antigo (o cliente perdeu o acesso a ele).
  const { error: errAuth } = await admin.auth.admin.updateUserById(dono.id, {
    email,
    email_confirm: true,
  });
  if (errAuth) {
    const jaExiste = /already|registered|exist|duplicate/i.test(errAuth.message);
    return { ok: false, erro: jaExiste ? "Já existe uma conta com esse e-mail." : errAuth.message };
  }

  // 2. Espelha nos perfis/config (best-effort).
  await admin.from("app_profiles").update({ email }).eq("id", dono.id);
  await admin.from("app_config").update({ email }).eq("tenant_id", tenantId);

  revalidatePath(`/admin/clientes/${tenantId}`);
  return { ok: true };
}

/**
 * EXCLUI a conta do cliente por completo: usuários no Auth + perfis + tenant.
 * Apagar app_tenants faz CASCADE em leads/mensagens/agendamentos/config/
 * kb_documents/tenant_secrets/trafego. app_profiles é SET NULL na FK, então é
 * removido manualmente ANTES (junto dos usuários do Auth). Irreversível.
 * Exige digitar o nome do negócio como confirmação.
 */
export async function excluirCliente(
  tenantId: string,
  confirmacao: string
): Promise<{ ok: boolean; erro?: string }> {
  await exigirSuper();
  const admin = getCrmAdmin();

  const { data: tenant } = await admin
    .from("app_tenants")
    .select("nome")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, erro: "Cliente não encontrado." };
  if (confirmacao.trim() !== tenant.nome)
    return { ok: false, erro: "Confirmação incorreta: digite o nome do negócio exatamente." };

  // 1. Usuários do Auth deste tenant (nunca um superadmin, por segurança).
  const { data: perfis } = await admin
    .from("app_profiles")
    .select("id,papel")
    .eq("tenant_id", tenantId);
  for (const p of perfis ?? []) {
    if (p.papel === "superadmin") continue;
    await admin.auth.admin.deleteUser(p.id);
  }

  // 2. Perfis (FK tenant_id = SET NULL não remove sozinho; some o vínculo).
  await admin.from("app_profiles").delete().eq("tenant_id", tenantId).neq("papel", "superadmin");

  // 3. Tenant — CASCADE limpa o resto dos dados do cliente.
  const { error } = await admin.from("app_tenants").delete().eq("id", tenantId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin");
  return { ok: true };
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
