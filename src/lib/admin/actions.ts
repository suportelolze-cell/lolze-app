"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCrmServer } from "@/lib/supabase/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao, IMPERSONATE_COOKIE } from "@/lib/supabase/tenant";
import { provisionarTenant } from "@/lib/cadastro/provisionar";
import { registrarAuditoria } from "./auditoria";

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
  const sb = await getCrmServer();
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

/**
 * Testa o agente do cliente em modo SIMULAÇÃO (bateria de implantação):
 * mesma persona/RAG/agenda, sem gravar mensagens nem tocar leads/canal.
 */
export async function testarAgente(
  tenantId: string,
  pergunta: string
): Promise<{ ok: boolean; resposta: string; acoes: string[]; erro?: string }> {
  await exigirSuper();
  const p = (pergunta || "").trim().slice(0, 400);
  if (!p) return { ok: false, resposta: "", acoes: [], erro: "Escreva a pergunta de teste." };
  const { simularSDR } = await import("@/lib/agent/sdr/simular");
  return simularSDR(tenantId, p);
}

/** Salva a conexão WhatsApp oficial (Cloud API). Token só é atualizado se enviado. */
export async function salvarWaCloudCfg(
  tenantId: string,
  cfg: { phoneNumberId: string; accessToken: string }
) {
  await exigirSuper();
  const sb = await getCrmServer();
  const patch: Record<string, unknown> = {
    tenant_id: tenantId,
    wa_phone_number_id: cfg.phoneNumberId.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (cfg.accessToken.trim()) patch.wa_access_token = cfg.accessToken.trim();
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
  const sb = await getCrmServer();
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
  const sb = await getCrmServer();
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

const CAMPOS_PERSONA = ["oferta", "publico", "tom", "objecoes", "faq", "regras"] as const;

/** Há algum texto de persona preenchido? (não snapshota um estado 100% vazio) */
function personaTemConteudo(r: Record<string, unknown> | null | undefined): boolean {
  if (!r) return false;
  return CAMPOS_PERSONA.some((c) => String(r[c] ?? "").trim() !== "");
}

/**
 * Snapshota a persona ATUAL de app_config em app_persona_versoes ANTES de
 * sobrescrever — é isso que permite reverter (undo). Best-effort: o histórico
 * é observação e nunca pode impedir o save em si.
 */
async function snapshotPersona(
  sb: Awaited<ReturnType<typeof getCrmServer>>,
  tenantId: string,
  origem: "edicao" | "rollback",
  userId: string | null
) {
  try {
    const { data: atual } = await sb
      .from("app_config")
      .select("oferta,publico,tom,objecoes,faq,regras")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!personaTemConteudo(atual)) return; // nada de útil para versionar

    let nome: string | null = null;
    if (userId) {
      const { data: perfil } = await sb
        .from("app_profiles")
        .select("nome")
        .eq("id", userId)
        .maybeSingle();
      nome = (perfil?.nome as string | null) ?? null;
    }

    await sb.from("app_persona_versoes").insert({
      tenant_id: tenantId,
      oferta: atual?.oferta ?? null,
      publico: atual?.publico ?? null,
      tom: atual?.tom ?? null,
      objecoes: atual?.objecoes ?? null,
      faq: atual?.faq ?? null,
      regras: atual?.regras ?? null,
      origem,
      criado_por: userId,
      criado_por_nome: nome,
    });
  } catch {
    /* histórico é best-effort */
  }
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
  },
  origem: "edicao" | "rollback" = "edicao"
) {
  const s = await exigirSuper();
  const sb = await getCrmServer();
  // Versiona o estado anterior (permite reverter) antes de sobrescrever.
  await snapshotPersona(sb, tenantId, origem, s.userId ?? null);
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
  await registrarAuditoria({
    acao: origem === "rollback" ? "persona.revertida" : "persona.editada",
    tenantId,
    detalhe: { agenteAtivo: p.agenteAtivo },
  });
  revalidatePath(`/admin/clientes/${tenantId}`);
}

export type VersaoPersona = {
  id: number;
  quando: string;
  quem: string | null;
  origem: string;
  preview: string; // trecho da oferta, para identificar a versão
};

/** Lista as versões anteriores da persona (mais recentes primeiro). Superadmin. */
export async function listarVersoesPersona(tenantId: string): Promise<VersaoPersona[]> {
  await exigirSuper();
  const sb = await getCrmServer();
  const { data } = await sb
    .from("app_persona_versoes")
    .select("id,created_at,criado_por_nome,origem,oferta,publico")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data as Record<string, unknown>[] | null) ?? []).map((v) => {
    const base = String(v.oferta ?? v.publico ?? "").trim();
    return {
      id: Number(v.id),
      quando: String(v.created_at),
      quem: (v.criado_por_nome as string | null) ?? null,
      origem: String(v.origem ?? "edicao"),
      preview: base ? base.slice(0, 120) : "(sem oferta preenchida)",
    };
  });
}

/**
 * Reverte a persona para uma versão anterior. O estado atual é versionado
 * antes (então reverter também é desfazível). Preserva o toggle agente_ativo
 * atual — reverter é sobre o TEXTO da persona, não sobre ligar/desligar a IA.
 */
export async function reverterPersona(
  tenantId: string,
  versaoId: number
): Promise<{ ok: boolean; erro?: string }> {
  await exigirSuper();
  const sb = await getCrmServer();
  const { data: v, error: eSel } = await sb
    .from("app_persona_versoes")
    .select("oferta,publico,tom,objecoes,faq,regras")
    .eq("id", versaoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (eSel) return { ok: false, erro: eSel.message };
  if (!v) return { ok: false, erro: "Versão não encontrada." };

  const { data: cfg } = await sb
    .from("app_config")
    .select("agente_ativo")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  await salvarPersona(
    tenantId,
    {
      oferta: (v.oferta as string | null) ?? "",
      publico: (v.publico as string | null) ?? "",
      tom: (v.tom as string | null) ?? "",
      objecoes: (v.objecoes as string | null) ?? "",
      faq: (v.faq as string | null) ?? "",
      regras: (v.regras as string | null) ?? "",
      agenteAtivo: (cfg?.agente_ativo as boolean | null) ?? true,
    },
    "rollback"
  );
  return { ok: true };
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

  const prov = await provisionarTenant({
    nomeNegocio,
    plano: form.plano,
    emailDono,
    nomeDono: form.nomeDono,
    senha: form.senha,
    telefone: form.telefone,
    canais: form.canais ?? [],
    status: "ativo",
  });
  if (!prov.ok) return { ok: false, erro: prov.erro };

  await registrarAuditoria({
    acao: "cliente.criado",
    tenantId: (prov as { tenantId?: string }).tenantId ?? null,
    alvo: nomeNegocio,
    detalhe: { plano: form.plano },
  });
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
  const sb = await getCrmServer();
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
  await registrarAuditoria({
    acao: "cliente.atualizado",
    tenantId: id,
    detalhe: {
      campos: Object.keys(campos).filter((k) => campos[k as keyof typeof campos] !== undefined),
      plano: campos.plano,
      status: campos.status,
    },
  });
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

  await registrarAuditoria({ acao: "acesso.email_alterado", tenantId, detalhe: { novoEmail: email } });
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

  // tenantId agora não existe mais (FK zeraria): registra com alvo preservado.
  await registrarAuditoria({ acao: "cliente.excluido", tenantId: null, alvo: tenant.nome });
  revalidatePath("/admin");
  return { ok: true };
}

/** Superadmin passa a "ver como" um cliente. */
export async function entrarComo(tenantId: string) {
  await exigirSuper();
  // Auditoria ANTES do redirect (redirect() lança para interromper o fluxo).
  await registrarAuditoria({ acao: "impersonacao.iniciada", tenantId });
  (await cookies()).set(IMPERSONATE_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/painel");
}

/** Sai do modo "ver como" e volta ao admin. */
export async function sairImpersonacao() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/admin");
}
