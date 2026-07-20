import { cookies } from "next/headers";
import { getCrmServer } from "./server";

/** Cookie que guarda o tenant que o superadmin está "vendo como". */
export const IMPERSONATE_COOKIE = "lolze_tenant";

export type Sessao = {
  userId: string | null;
  papel: string; // superadmin | owner | membro | ''
  tenantId: string | null; // tenant efetivo (do perfil, ou o impersonado)
  impersonating: boolean;
};

/**
 * Sessão efetiva do usuário logado.
 * - Cliente comum: o tenant é o do próprio perfil.
 * - Superadmin: se houver cookie de impersonation, usa aquele tenant.
 */
export async function getSessao(): Promise<Sessao> {
  const sb = await getCrmServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { userId: null, papel: "", tenantId: null, impersonating: false };
  }

  const { data: perfil } = await sb
    .from("app_profiles")
    .select("papel,tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  // Sem perfil = sem privilégio (não assume "owner" por padrão).
  const papel = perfil?.papel ?? "";
  let tenantId: string | null = perfil?.tenant_id ?? null;
  let impersonating = false;

  if (papel === "superadmin") {
    const c = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (c) {
      tenantId = c;
      impersonating = true;
    }
  }

  return { userId: user.id, papel, tenantId, impersonating };
}

/** Atalho: só o tenant efetivo (null se superadmin sem impersonar). */
export async function getTenantId(): Promise<string | null> {
  return (await getSessao()).tenantId;
}
