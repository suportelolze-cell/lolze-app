import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Provisiona uma nova empresa (tenant) do zero: tenant + usuário de acesso
 * (owner) + perfil + configuração + secrets. É o núcleo compartilhado entre o
 * cadastro do admin (concierge) e o cadastro público (self-service).
 * Usa service_role — chame apenas de server actions.
 */
export type ProvisionInput = {
  nomeNegocio: string;
  plano: string;
  emailDono: string;
  nomeDono: string;
  senha: string;
  telefone?: string;
  canais?: string[];
  status?: string; // "ativo" (concierge) ou "pendente" (aguardando pagamento)
};

function gerarSlug(nome: string) {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function provisionarTenant(
  input: ProvisionInput
): Promise<{ ok: boolean; tenantId?: string; erro?: string }> {
  let admin;
  try {
    admin = getCrmAdmin();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  const nomeNegocio = input.nomeNegocio.trim();
  const emailDono = input.emailDono.trim().toLowerCase();

  // 1. Tenant
  const { data: tenant, error: errT } = await admin
    .from("app_tenants")
    .insert({
      nome: nomeNegocio,
      slug: gerarSlug(nomeNegocio),
      plano: input.plano,
      status: input.status ?? "ativo",
      canais: input.canais ?? [],
      contato_email: emailDono,
      contato_telefone: input.telefone ?? null,
    })
    .select("id")
    .single();
  if (errT || !tenant) return { ok: false, erro: errT?.message ?? "Falha ao criar a empresa." };

  // 2. Usuário de acesso (owner)
  const { data: u, error: errU } = await admin.auth.admin.createUser({
    email: emailDono,
    password: input.senha,
    email_confirm: true,
  });
  if (errU || !u?.user) {
    await admin.from("app_tenants").delete().eq("id", tenant.id); // limpa o órfão
    const jaExiste = /already|registered|exist|duplicate/i.test(errU?.message ?? "");
    return {
      ok: false,
      erro: jaExiste
        ? "Já existe uma conta com esse e-mail. Faça login."
        : errU?.message ?? "Falha ao criar o acesso.",
    };
  }

  // 3. Perfil + 4. Config + 5. Secrets (token de integração via default da tabela)
  await admin.from("app_profiles").insert({
    id: u.user.id,
    nome: input.nomeDono.trim() || nomeNegocio,
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
  await admin.from("app_tenant_secrets").insert({ tenant_id: tenant.id });

  return { ok: true, tenantId: tenant.id };
}
