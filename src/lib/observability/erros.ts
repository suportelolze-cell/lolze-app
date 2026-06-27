import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";

/**
 * Registro central de erros (substitui os `catch {}` silenciosos).
 *
 * - Sempre best-effort: NUNCA lança (não pode derrubar o fluxo que o chamou).
 * - Grava o erro em `app_erros` (a "planilha limpa" para revisar depois).
 * - Para severidade "alta", avisa o WhatsApp de operação (LOLZE_OPS_WHATSAPP),
 *   com throttle para não floodar (1 alerta por contexto/tenant na janela).
 */

export type Severidade = "baixa" | "media" | "alta";

type RegistroErro = {
  tenantId?: string | null;
  contexto: string; // ex.: "whatsapp.inbound", "sdr.run", "followup"
  erro: unknown;
  leadId?: number | null;
  severidade?: Severidade;
  /** Janela do throttle do alerta, em minutos (padrão 30). */
  janelaAlertaMin?: number;
};

type Admin = ReturnType<typeof getCrmAdmin>;

async function instanciaDoTenant(admin: Admin, tenantId: string | null): Promise<string> {
  const fixa = (process.env.LOLZE_OPS_INSTANCE || "").trim();
  if (fixa) return fixa;
  if (!tenantId) return "";
  const { data } = await admin
    .from("app_tenant_secrets")
    .select("evolution_instance")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return ((data?.evolution_instance as string | null) ?? "").trim();
}

export async function registrarErro(input: RegistroErro): Promise<void> {
  const {
    tenantId = null,
    contexto,
    erro,
    leadId = null,
    severidade = "media",
    janelaAlertaMin = 30,
  } = input;

  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const detalhe = erro instanceof Error ? erro.stack ?? null : null;

  let admin: Admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return; // sem service-role não há onde gravar
  }

  // 1) grava o log (best-effort)
  try {
    await admin.from("app_erros").insert({
      tenant_id: tenantId,
      contexto,
      mensagem: mensagem.slice(0, 2000),
      detalhe: detalhe ? detalhe.slice(0, 4000) : null,
      lead_id: leadId,
      severidade,
    });
  } catch {
    /* nada a fazer */
  }

  if (severidade !== "alta") return;

  // 2) alerta no WhatsApp de operação (throttle por contexto+tenant na janela)
  try {
    const ops = (process.env.LOLZE_OPS_WHATSAPP || "").trim();
    if (!ops || !temEvolutionConfig()) return;

    const desde = new Date(Date.now() - janelaAlertaMin * 60_000).toISOString();
    let q = admin
      .from("app_erros")
      .select("id", { count: "exact", head: true })
      .eq("contexto", contexto)
      .eq("severidade", "alta")
      .gte("created_at", desde);
    q = tenantId ? q.eq("tenant_id", tenantId) : q.is("tenant_id", null);
    const { count } = await q;
    // count inclui o registro que acabamos de inserir; se já havia outro na
    // janela, alguém já foi avisado → não repete.
    if ((count ?? 0) > 1) return;

    const instancia = await instanciaDoTenant(admin, tenantId);
    if (!instancia) return;

    const txt = [
      `🚨 *Lolze* — erro (${severidade})`,
      `Contexto: ${contexto}`,
      tenantId ? `Empresa: ${tenantId}` : "",
      leadId ? `Lead: ${leadId}` : "",
      `Mensagem: ${mensagem.slice(0, 300)}`,
    ]
      .filter(Boolean)
      .join("\n");
    await enviarTexto(instancia, ops, txt).catch(() => null);
  } catch {
    /* alerta é best-effort */
  }
}
