import { createClient } from "@supabase/supabase-js";

/**
 * Cliente ADMIN do CRM (service_role) — SERVER-ONLY.
 * Usa SUPABASE_CRM_SERVICE_KEY (sem NEXT_PUBLIC, nunca vai pro browser).
 * Necessário para operações de admin que o RLS/JWT não cobre, em especial
 * criar usuários de auth (auth.admin.createUser).
 *
 * Só importe isto de server actions / server components gated a superadmin.
 */
export function getCrmAdmin() {
  const key = process.env.SUPABASE_CRM_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_CRM_SERVICE_KEY ausente. Cole a service_role do projeto CRM no .env.local para cadastrar clientes."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_CRM_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Indica se a chave de service role do CRM está configurada. */
export function temServiceKey() {
  return Boolean(process.env.SUPABASE_CRM_SERVICE_KEY);
}
