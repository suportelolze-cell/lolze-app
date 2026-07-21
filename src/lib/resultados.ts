import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";
import { agregarResultados, normalizarJanela, resultadoVazio, type EventoRow, type Resultados } from "@/lib/resultados-core";

/**
 * Tela "Resultados" — ROI VERIFICÁVEL POR EVENTOS (dossiê, direção do produto).
 *
 * Diferente do "Raio-X do Funil" (que lê o snapshot operacional app_leads +
 * gasto de mídia app_trafego), aqui a fonte é o LEDGER IMUTÁVEL app_eventos:
 * cada número é um fato datado. A matemática vive em resultados-core.ts (pura,
 * testável); aqui só lemos o ledger do tenant ativo.
 *
 * Usa service_role com filtro explícito de tenant (mesmo padrão de getHoje),
 * porque o ledger é observação de bastidor.
 */

export type { Resultados, EtapaResultado, CanalResultado } from "@/lib/resultados-core";

/** Lê o ledger do tenant ativo (últimos `dias`) e agrega os resultados. */
export async function getResultados(dias = 30): Promise<Resultados> {
  const janela = normalizarJanela(dias);
  const tid = await getTenantId();
  if (!tid) return resultadoVazio(janela);

  const corte = new Date();
  corte.setDate(corte.getDate() - janela);

  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_eventos")
    .select("tipo,lead_id,canal,origem,valor_cents,created_at")
    .eq("tenant_id", tid)
    .gte("created_at", corte.toISOString());

  return agregarResultados((data as EventoRow[] | null) ?? [], janela);
}
