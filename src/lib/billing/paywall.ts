import { unstable_cache } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Status de cobrança do tenant, CACHEADO por ~15s por tenant. O layout do app
 * chama isto em TODA navegação (gate de paywall) — cachear tira 1 ida ao banco
 * das navegações rápidas (o caso comum de clicar entre telas). TTL curto (15s)
 * para que uma mudança de status (pagou/lapsou) reflita quase na hora sem
 * depender de invalidação manual. Fail-closed: em erro devolve null (o layout
 * trata null como NÃO-ativo).
 */
export async function statusCobrancaCacheado(tenantId: string): Promise<string | null> {
  const buscar = unstable_cache(
    async () => {
      try {
        const admin = getCrmAdmin();
        const { data } = await admin
          .from("app_tenants")
          .select("status")
          .eq("id", tenantId)
          .maybeSingle();
        return ((data?.status as string | null) ?? "").toLowerCase();
      } catch {
        return null; // não deu pra confirmar → o layout redireciona (fail-closed)
      }
    },
    ["cobranca-status", tenantId],
    { revalidate: 15 }
  );
  return buscar();
}
