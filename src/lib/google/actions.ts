"use server";

import { revalidatePath } from "next/cache";
import { getTenantId } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";

/** Desconecta o Google Calendar do tenant ativo (limpa o refresh token). */
export async function desconectarGoogle(): Promise<void> {
  const tid = await getTenantId();
  if (!tid) return;
  const admin = getCrmAdmin();
  await admin
    .from("app_tenant_secrets")
    .update({ google_refresh_token: null, google_calendar_id: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", tid);
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
}
