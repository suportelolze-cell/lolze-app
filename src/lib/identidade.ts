import { getCrmAdmin } from "@/lib/supabase/admin";

/**
 * Identidade entre canais ("um cliente, uma memória", dossiê P1.2).
 *
 * Um lead pode ter várias identidades (WhatsApp, Instagram, ...) em
 * app_lead_canais. Os webhooks resolvem o lead POR AQUI — assim o mesmo humano
 * que muda de canal cai na MESMA ficha, com todo o histórico. Ao criar
 * identidade de WhatsApp, tenta unificar automaticamente com um lead existente
 * que tenha o mesmo telefone (ex.: lead cadastrado manualmente que depois
 * escreveu no WhatsApp).
 */

type Admin = ReturnType<typeof getCrmAdmin>;

export type LeadResolvido = {
  id: number;
  atendente_id: string | null;
  followup_modo: string | null;
};

/** Vincula uma identidade de canal ao lead (idempotente: conflito é ignorado). */
export async function vincularIdentidade(
  admin: Admin,
  tenantId: string,
  leadId: number,
  canal: string,
  canalUserId: string
): Promise<void> {
  const { error } = await admin.from("app_lead_canais").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    canal,
    canal_user_id: canalUserId,
  });
  // 23505 = identidade já vinculada (ok); outros erros não podem derrubar o webhook.
  void error;
}

/**
 * Resolve o lead dono de uma identidade de canal.
 * 1. Identidade já vinculada → é ele.
 * 2. WhatsApp sem vínculo → procura lead do tenant com o MESMO telefone
 *    (unificação automática: lead manual/site que agora escreveu no WhatsApp).
 * 3. Nada → null (o chamador cria o lead e vincula).
 */
export async function resolverLead(
  admin: Admin,
  tenantId: string,
  canal: string,
  canalUserId: string
): Promise<LeadResolvido | null> {
  const { data: ident } = await admin
    .from("app_lead_canais")
    .select("lead_id")
    .eq("tenant_id", tenantId)
    .eq("canal", canal)
    .eq("canal_user_id", canalUserId)
    .maybeSingle();

  if (ident?.lead_id) {
    const { data: l } = await admin
      .from("app_leads")
      .select("id,atendente_id,followup_modo")
      .eq("tenant_id", tenantId)
      .eq("id", ident.lead_id)
      .maybeSingle();
    if (l) return l as LeadResolvido;
  }

  // Unificação automática por telefone (só faz sentido no WhatsApp, onde o
  // id do canal É o telefone).
  if (canal === "whatsapp") {
    const digitos = canalUserId.replace(/\D/g, "");
    if (digitos.length >= 8) {
      const { data: porTel } = await admin
        .from("app_leads")
        .select("id,atendente_id,followup_modo")
        .eq("tenant_id", tenantId)
        .eq("telefone", digitos)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (porTel) {
        await vincularIdentidade(admin, tenantId, (porTel as LeadResolvido).id, canal, canalUserId);
        return porTel as LeadResolvido;
      }
    }
  }

  return null;
}

const TIPOS_ONE_SHOT = [
  "lead_received",
  "first_response_sent",
  "qualified",
  "handoff_requested",
  "sale_won",
];

export type ResultadoMescla = { ok: boolean; erro?: string };

/**
 * Mescla dois leads do MESMO tenant: o histórico (mensagens, eventos,
 * agendamentos, identidades) do `absorvidoId` passa para o `principalId`;
 * telefone/e-mail/valor faltantes são herdados; o absorvido é removido.
 */
export async function mesclarLeads(
  tenantId: string,
  principalId: number,
  absorvidoId: number
): Promise<ResultadoMescla> {
  if (principalId === absorvidoId) return { ok: false, erro: "Escolha dois contatos diferentes." };
  const admin = getCrmAdmin();

  const { data: pares } = await admin
    .from("app_leads")
    .select("id,telefone,email,valor")
    .eq("tenant_id", tenantId)
    .in("id", [principalId, absorvidoId]);
  const principal = (pares ?? []).find((l) => l.id === principalId);
  const absorvido = (pares ?? []).find((l) => l.id === absorvidoId);
  if (!principal || !absorvido) return { ok: false, erro: "Contato não encontrado." };

  // 1) Move o histórico. (Filtra sempre por tenant para nunca vazar entre clientes.)
  const mover = async (tabela: string) => {
    const { error } = await admin
      .from(tabela)
      .update({ lead_id: principalId })
      .eq("tenant_id", tenantId)
      .eq("lead_id", absorvidoId);
    if (error) throw new Error(`${tabela}: ${error.message}`);
  };

  try {
    await mover("app_mensagens");
    await mover("app_agendamentos");
    await mover("app_lead_canais");

    // Eventos: os one-shot que o principal JÁ tem não podem ser movidos
    // (violariam o índice único) — descarta os do absorvido e move o resto.
    const { data: doPrincipal } = await admin
      .from("app_eventos")
      .select("tipo")
      .eq("tenant_id", tenantId)
      .eq("lead_id", principalId)
      .in("tipo", TIPOS_ONE_SHOT);
    const jaTem = Array.from(new Set((doPrincipal ?? []).map((e) => e.tipo as string)));
    if (jaTem.length > 0) {
      await admin
        .from("app_eventos")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("lead_id", absorvidoId)
        .in("tipo", jaTem);
    }
    await mover("app_eventos");
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }

  // 2) Herda contatos/valor que faltarem no principal.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!principal.telefone && absorvido.telefone) patch.telefone = absorvido.telefone;
  if (!principal.email && absorvido.email) patch.email = absorvido.email;
  if (principal.valor == null && absorvido.valor != null) patch.valor = absorvido.valor;
  await admin.from("app_leads").update(patch).eq("tenant_id", tenantId).eq("id", principalId);

  // 3) Remove a ficha absorvida (o histórico já foi movido).
  const { error: errDel } = await admin
    .from("app_leads")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", absorvidoId);
  if (errDel) return { ok: false, erro: errDel.message };

  return { ok: true };
}
