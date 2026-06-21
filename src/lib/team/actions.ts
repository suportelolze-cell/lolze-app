"use server";

import { revalidatePath } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

export type ResMembro = { ok: boolean; erro?: string; email?: string; senha?: string };

/** Adiciona um SDR à empresa, respeitando o limite do plano. */
export async function adicionarMembro(form: {
  nome: string;
  email: string;
  senha: string;
}): Promise<ResMembro> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return { ok: false, erro: "Sem permissão." };
  if (!s.tenantId) return { ok: false, erro: "Sem empresa ativa." };

  const email = form.email.trim().toLowerCase();
  if (!email) return { ok: false, erro: "Informe o e-mail." };
  if (!form.senha || form.senha.length < 6)
    return { ok: false, erro: "A senha precisa ter ao menos 6 caracteres." };

  let admin;
  try {
    admin = getCrmAdmin();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  // Limite de SDRs do plano
  const { data: tenant } = await admin
    .from("app_tenants")
    .select("plano")
    .eq("id", s.tenantId)
    .single();
  const { data: plano } = await admin
    .from("app_plans")
    .select("sdr_max")
    .eq("id", tenant?.plano ?? "start")
    .single();
  const sdrMax = plano?.sdr_max ?? 0;

  const { count } = await admin
    .from("app_profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", s.tenantId)
    .in("papel", ["membro", "sdr"]);

  if ((count ?? 0) >= sdrMax) {
    return {
      ok: false,
      erro: `Limite de ${sdrMax} SDRs do plano atingido. Remova um membro para adicionar outro.`,
    };
  }

  // Cria usuário + perfil
  const { data: u, error: errU } = await admin.auth.admin.createUser({
    email,
    password: form.senha,
    email_confirm: true,
  });
  if (errU || !u?.user) return { ok: false, erro: errU?.message ?? "Falha ao criar acesso." };

  const { error: errP } = await admin.from("app_profiles").insert({
    id: u.user.id,
    nome: form.nome.trim() || email.split("@")[0],
    email,
    papel: "membro",
    tenant_id: s.tenantId,
  });
  if (errP) {
    await admin.auth.admin.deleteUser(u.user.id);
    return { ok: false, erro: errP.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, email, senha: form.senha };
}

/** Remove um SDR (libera vaga no plano). */
export async function removerMembro(profileId: string): Promise<ResMembro> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return { ok: false, erro: "Sem permissão." };
  if (!s.tenantId) return { ok: false, erro: "Sem empresa ativa." };
  if (profileId === s.userId) return { ok: false, erro: "Você não pode remover a si mesmo." };

  let admin;
  try {
    admin = getCrmAdmin();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  const { data: alvo } = await admin
    .from("app_profiles")
    .select("papel,tenant_id")
    .eq("id", profileId)
    .single();
  if (!alvo || alvo.tenant_id !== s.tenantId)
    return { ok: false, erro: "Membro não encontrado nesta empresa." };
  if (alvo.papel === "owner") return { ok: false, erro: "Não é possível remover o dono." };

  await admin.from("app_profiles").delete().eq("id", profileId);
  await admin.auth.admin.deleteUser(profileId);

  revalidatePath("/configuracoes");
  return { ok: true };
}
