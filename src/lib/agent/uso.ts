import { getCrmAdmin } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability/erros";
import { custoBRLCents, type UsoTokens } from "./custo";

/**
 * Contabiliza o uso de tokens da IA por tenant/dia (tabela app_uso_ia, via a
 * função SQL incrementar_uso_ia) e, se houver um teto mensal configurado
 * (LOLZE_TETO_IA_CENTS, em centavos de BRL), avisa no WhatsApp de operação
 * quando o gasto do mês cruza o teto — no máximo 1 vez por dia.
 *
 * Best-effort: nunca lança.
 */
export async function registrarUsoIA(tenantId: string, uso: UsoTokens): Promise<void> {
  if (!tenantId) return;
  const total = uso.inputTokens + uso.outputTokens + uso.cacheCreation + uso.cacheRead;
  if (total <= 0) return;

  let admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  try {
    await admin.rpc("incrementar_uso_ia", {
      p_tenant: tenantId,
      p_dia: hoje,
      p_in: uso.inputTokens,
      p_out: uso.outputTokens,
      p_cc: uso.cacheCreation,
      p_cr: uso.cacheRead,
    });
  } catch {
    /* contabilização é best-effort */
  }

  // Teto mensal (plataforma) — opcional.
  const tetoCents = Number(process.env.LOLZE_TETO_IA_CENTS);
  if (!Number.isFinite(tetoCents) || tetoCents <= 0) return;

  try {
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    const primeiroDia = inicioMes.toISOString().slice(0, 10);

    const { data } = await admin
      .from("app_uso_ia")
      .select("input_tokens,output_tokens,cache_creation,cache_read")
      .gte("dia", primeiroDia);
    const linhas = (data ?? []) as Array<Record<string, number | null>>;
    const somaMes = linhas.reduce<UsoTokens>(
      (acc, r) => ({
        inputTokens: acc.inputTokens + Number(r.input_tokens ?? 0),
        outputTokens: acc.outputTokens + Number(r.output_tokens ?? 0),
        cacheCreation: acc.cacheCreation + Number(r.cache_creation ?? 0),
        cacheRead: acc.cacheRead + Number(r.cache_read ?? 0),
      }),
      { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 }
    );
    const gastoCents = custoBRLCents(somaMes);
    if (gastoCents < tetoCents) return;

    const brl = (c: number) => `R$ ${(c / 100).toFixed(2)}`;
    // registrarErro grava + dispara o WhatsApp de operação; throttle de 24h
    // evita repetir o aviso de teto mais de 1x por dia.
    await registrarErro({
      contexto: "ia.custo.teto",
      severidade: "alta",
      janelaAlertaMin: 24 * 60,
      erro: new Error(
        `Gasto de IA do mês (${brl(gastoCents)}) atingiu o teto (${brl(tetoCents)}).`
      ),
    });
  } catch {
    /* verificação de teto é best-effort */
  }
}
