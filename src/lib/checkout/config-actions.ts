"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { PLATAFORMAS, type Plataforma, type IntegracaoCheckoutView } from "./core";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";
const novoToken = () => crypto.randomBytes(32).toString("hex");
const plataformaValida = (p: string): p is Plataforma => (PLATAFORMAS as string[]).includes(p);

/** Estado das integrações de checkout do tenant (só gestor). Nunca devolve o secret. */
export async function getIntegracoesCheckout(): Promise<{
  ok: boolean;
  erro?: string;
  itens?: IntegracaoCheckoutView[];
}> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const admin = getCrmAdmin();
  const { data, error } = await admin
    .from("app_checkout_integracoes")
    .select("plataforma,ingest_token,secret,ativo")
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };

  const rows = (data ?? []) as {
    plataforma: string;
    ingest_token: string;
    secret: string | null;
    ativo: boolean;
  }[];
  const porPlat = new Map(rows.map((r) => [r.plataforma, r]));

  const itens: IntegracaoCheckoutView[] = PLATAFORMAS.map((p) => {
    const r = porPlat.get(p);
    return {
      plataforma: p,
      ativo: r?.ativo ?? false,
      temSecret: Boolean(r?.secret),
      ingestToken: r?.ingest_token ?? "",
      configurada: Boolean(r),
    };
  });
  return { ok: true, itens };
}

/**
 * Salva/atualiza uma integração. Gera o ingest_token na primeira vez. O secret
 * só é sobrescrito quando o usuário digita um novo (campo vazio mantém o atual).
 */
export async function salvarIntegracaoCheckout(input: {
  plataforma: string;
  secret?: string;
  ativo?: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  if (!plataformaValida(input.plataforma)) return { ok: false, erro: "Plataforma inválida." };

  const admin = getCrmAdmin();
  const secretNovo = typeof input.secret === "string" ? input.secret.trim() : "";
  const ativo = input.ativo ?? true;

  const { data: atual, error: errSel } = await admin
    .from("app_checkout_integracoes")
    .select("id")
    .eq("tenant_id", s.tenantId)
    .eq("plataforma", input.plataforma)
    .maybeSingle();
  if (errSel) return { ok: false, erro: errSel.message };

  if (atual) {
    const patch: Record<string, unknown> = { ativo };
    if (secretNovo) patch.secret = secretNovo;
    const { error } = await admin
      .from("app_checkout_integracoes")
      .update(patch)
      .eq("tenant_id", s.tenantId)
      .eq("plataforma", input.plataforma);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await admin.from("app_checkout_integracoes").insert({
      tenant_id: s.tenantId,
      plataforma: input.plataforma,
      ingest_token: novoToken(),
      secret: secretNovo || null,
      ativo,
    });
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Gera um novo token de webhook (invalida a URL antiga). Só gestor. */
export async function regenerarTokenCheckout(
  plataforma: string
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  if (!plataformaValida(plataforma)) return { ok: false, erro: "Plataforma inválida." };

  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_checkout_integracoes")
    .update({ ingest_token: novoToken() })
    .eq("tenant_id", s.tenantId)
    .eq("plataforma", plataforma);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}
