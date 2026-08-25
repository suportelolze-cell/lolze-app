import { getCrmAdmin } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos";
import { registrarErro } from "@/lib/observability/erros";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { agendarRecuperacao } from "@/lib/agent/followup-cadencia";
import { buscarMensagemEntrega } from "./entrega";
import type { VendaCanonica } from "./core";

type Admin = ReturnType<typeof getCrmAdmin>;

/** Eventos de venda pendente que disparam a régua de recuperação. */
const EVENTOS_RECUPERAVEIS = new Set(["pix_gerado", "boleto_gerado", "checkout_abandonado"]);

export type ResultadoIngestao =
  | { duplicado: true }
  | { registrado: true; leadId: number | null };

/**
 * Resolve o lead comprador (por e-mail, depois por telefone) ou cria um novo.
 * Preenche e-mail/telefone que faltarem na ficha existente ("um cliente, uma
 * memória"). Retorna null só quando não há e-mail nem telefone (nada a ligar).
 */
async function resolverOuCriarLead(
  admin: Admin,
  tenantId: string,
  venda: VendaCanonica
): Promise<number | null> {
  const email = venda.comprador.email;
  const tel = venda.comprador.telefone;

  type LeadMin = { id: number; email: string | null; telefone: string | null };
  let lead: LeadMin | null = null;

  if (email) {
    const { data } = await admin
      .from("app_leads")
      .select("id,email,telefone")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    lead = (data as LeadMin | null) ?? null;
  }
  if (!lead && tel) {
    const { data } = await admin
      .from("app_leads")
      .select("id,email,telefone")
      .eq("tenant_id", tenantId)
      .eq("telefone", tel)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    lead = (data as LeadMin | null) ?? null;
  }

  if (lead) {
    const patch: Record<string, unknown> = {};
    if (!lead.email && email) patch.email = email;
    if (!lead.telefone && tel) patch.telefone = tel;
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      await admin.from("app_leads").update(patch).eq("tenant_id", tenantId).eq("id", lead.id);
    }
    return lead.id;
  }

  if (!email && !tel) return null;

  const { data: novo, error } = await admin
    .from("app_leads")
    .insert({
      tenant_id: tenantId,
      nome: venda.comprador.nome || "Comprador",
      email: email || null,
      telefone: tel || null,
      origem: "outro",
      canal: "checkout",
      temperatura: "frio",
      coluna: "entrada",
    })
    .select("id")
    .single();
  if (error) throw new Error("criar lead comprador: " + error.message);
  return (novo as { id: number }).id;
}

/**
 * Ingere uma venda canônica: idempotente por (tenant, plataforma, external_id,
 * evento). Persiste em app_vendas, liga/cria o lead comprador e, na compra
 * aprovada, marca o lead como cliente (ganho) e alimenta o ledger de receita.
 */
export async function ingerirVenda(
  admin: Admin,
  tenantId: string,
  plataforma: string,
  venda: VendaCanonica,
  raw: unknown
): Promise<ResultadoIngestao> {
  // Idempotência (checagem otimista; o índice único abaixo garante na corrida).
  const { data: dup } = await admin
    .from("app_vendas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("plataforma", plataforma)
    .eq("external_id", venda.externalId)
    .eq("evento", venda.evento)
    .maybeSingle();
  if (dup) return { duplicado: true };

  const leadId = await resolverOuCriarLead(admin, tenantId, venda);

  const { error } = await admin.from("app_vendas").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    plataforma,
    external_id: venda.externalId,
    evento: venda.evento,
    status: venda.statusOriginal,
    produto_nome: venda.produtoNome || null,
    oferta: venda.oferta || null,
    valor_cents: venda.valorCents,
    moeda: venda.moeda,
    metodo_pagamento: venda.metodoPagamento || null,
    comprador_nome: venda.comprador.nome || null,
    comprador_email: venda.comprador.email || null,
    comprador_telefone: venda.comprador.telefone || null,
    raw: (raw ?? {}) as Record<string, unknown>,
  });
  if (error) {
    // 23505 = corrida com outra entrega do mesmo evento → já processado.
    if ((error as { code?: string }).code === "23505") return { duplicado: true };
    throw new Error("app_vendas: " + error.message);
  }

  // Compra aprovada: vira cliente no funil + ledger de receita.
  if (venda.evento === "compra_aprovada" && leadId) {
    const patch: Record<string, unknown> = {
      coluna: "ganho",
      temperatura: "quente",
      // Compra concluída → cancela qualquer régua de recuperação pendente.
      proximo_followup: null,
      followup_modo: null,
      updated_at: new Date().toISOString(),
    };
    if (venda.valorCents > 0) patch.valor = venda.valorCents / 100;
    await admin.from("app_leads").update(patch).eq("tenant_id", tenantId).eq("id", leadId);

    await registrarEvento({
      tenantId,
      leadId,
      tipo: "sale_won",
      origem: plataforma,
      valorCents: venda.valorCents,
      dados: { plataforma, produto: venda.produtoNome, oferta: venda.oferta },
    });
    await registrarEvento({
      tenantId,
      leadId,
      tipo: "revenue_confirmed",
      origem: plataforma,
      valorCents: venda.valorCents,
      dados: { plataforma, external_id: venda.externalId },
    });

    // Entrega automática do acesso: só se houver mensagem configurada e o lead
    // for alcançável por canal de mensagem (WhatsApp/Instagram). Best-effort:
    // nunca quebra a ingestão. Roda uma vez por compra (o bloco é idempotente).
    try {
      const { data: l } = await admin
        .from("app_leads")
        .select("canal")
        .eq("tenant_id", tenantId)
        .eq("id", leadId)
        .maybeSingle();
      const canal = (l?.canal as string | undefined) ?? "";
      if (canal === "whatsapp" || canal === "instagram") {
        const mensagem = await buscarMensagemEntrega(admin, tenantId, venda.oferta);
        if (mensagem) {
          const { data: msgRow } = await admin
            .from("app_mensagens")
            .insert({ tenant_id: tenantId, lead_id: leadId, autor: "ia", texto: mensagem })
            .select("id")
            .single();
          const entrega = await dispatchOutbound(
            tenantId,
            leadId,
            mensagem,
            (msgRow?.id as number | undefined) ?? undefined
          );
          await registrarEvento({
            tenantId,
            leadId,
            tipo: "entrega_enviada",
            origem: plataforma,
            dados: { plataforma, oferta: venda.oferta, entregue: entrega.ok },
          });
        }
      }
    } catch (e) {
      await registrarErro({ tenantId, leadId, contexto: "checkout.entrega", erro: e, severidade: "media" });
    }
  }

  // Venda pendente (PIX/boleto gerado, carrinho abandonado): agenda a régua de
  // recuperação. Só para quem dá pra alcançar por um canal de mensagem
  // (WhatsApp/Instagram) — um lead só-de-checkout, sem canal, não recebe e
  // entraria em loop de reentrega. E nunca para quem já é cliente (ganho) ou
  // perdido. Quando a compra_aprovada chegar, o lead vira 'ganho' e a régua para
  // sozinha.
  if (leadId && EVENTOS_RECUPERAVEIS.has(venda.evento)) {
    const { data: l } = await admin
      .from("app_leads")
      .select("coluna,canal")
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .maybeSingle();
    const coluna = (l?.coluna as string | undefined) ?? "entrada";
    const canal = (l?.canal as string | undefined) ?? "";
    const alcancavel = canal === "whatsapp" || canal === "instagram";
    if (alcancavel && coluna !== "ganho" && coluna !== "perdido") {
      const r = agendarRecuperacao();
      await admin
        .from("app_leads")
        .update({
          proximo_followup: r.proximo,
          followup_modo: r.modo,
          followup_count: r.count,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("id", leadId);
    }
  }

  // Reembolso / chargeback: registra no ledger (visibilidade + métrica de refund).
  // A ficha do lead NÃO é movida automaticamente — a decisão fica com o humano.
  if ((venda.evento === "reembolso" || venda.evento === "chargeback") && leadId) {
    await registrarEvento({
      tenantId,
      leadId,
      tipo: "venda_reembolsada",
      origem: plataforma,
      valorCents: venda.valorCents,
      dados: { plataforma, tipo: venda.evento, external_id: venda.externalId },
    });
  }

  return { registrado: true, leadId };
}
