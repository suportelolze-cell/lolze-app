import { getCrmAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * Busca a mensagem de entrega para uma compra: tenta a específica da oferta e,
 * se não houver, cai na mensagem PADRÃO do tenant (oferta = ''). Retorna null
 * quando não há mensagem ativa configurada — nesse caso NÃO se entrega nada
 * (não manda mensagem genérica errada). Tolerante à tabela ausente (migração
 * pendente): retorna null sem quebrar.
 */
export async function buscarMensagemEntrega(
  admin: Admin,
  tenantId: string,
  oferta: string
): Promise<string | null> {
  const chaves = oferta ? [oferta, ""] : [""];
  const { data, error } = await admin
    .from("app_entregas")
    .select("oferta,mensagem,ativo")
    .eq("tenant_id", tenantId)
    .in("oferta", chaves);
  if (error || !data) return null;

  const rows = data as { oferta: string; mensagem: string; ativo: boolean }[];
  const util = (r: { mensagem: string; ativo: boolean } | undefined) =>
    r && r.ativo && r.mensagem.trim() ? r.mensagem.trim() : null;

  // Prioriza a mensagem específica da oferta; senão, a padrão ('').
  if (oferta) {
    const esp = util(rows.find((r) => r.oferta === oferta));
    if (esp) return esp;
  }
  return util(rows.find((r) => r.oferta === ""));
}
