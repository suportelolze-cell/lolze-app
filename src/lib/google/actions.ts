"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Desconecta o Google Calendar do tenant ativo (limpa o refresh token). Só gestor. */
export async function desconectarGoogle(): Promise<void> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return; // conectar também é só gestor (/api/google/start)
  const tid = s.tenantId;
  if (!tid) return;
  const admin = getCrmAdmin();
  await admin
    .from("app_tenant_secrets")
    .update({ google_refresh_token: null, google_calendar_id: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", tid);
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
}
