import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { executarSDR } from "@/lib/agent/sdr/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // o SDR (Claude + RAG) roda aqui; precisa de folga (Vercel Pro)

/**
 * Entrada vinda do n8n (um fluxo por cliente).
 * Autentica pelo token do cliente (Bearer), grava lead + mensagem no tenant
 * correto e devolve o estado atual (para a IA decidir se responde).
 *
 * POST /api/ingest
 * Authorization: Bearer <ingest_token do cliente>
 * body: {
 *   canal: "whatsapp" | "instagram" | "facebook" | "telegram" | "site",
 *   contato: { nome?, telefone?, email?, canal_user_id? },
 *   mensagem: { autor?: "lead"|"ia"|"atendente", texto },
 *   origem?, meta?: { temperatura?, precisa_humano?, diagnostico? }
 * }
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  let admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const { data: secret } = await admin
    .from("app_tenant_secrets")
    .select("tenant_id")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!secret) return NextResponse.json({ erro: "token invalido" }, { status: 401 });
  const tenantId = secret.tenant_id as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  const canal = String(body?.canal || "whatsapp");
  const contato = body?.contato ?? {};
  const mensagem = body?.mensagem ?? {};
  const meta = body?.meta ?? {};
  const canalUserId = String(contato.canal_user_id || contato.telefone || "").trim();
  const texto = String(mensagem.texto || "").trim();
  const autor = ["lead", "ia", "atendente"].includes(mensagem.autor) ? mensagem.autor : "lead";
  if (!texto) return NextResponse.json({ erro: "texto vazio" }, { status: 400 });

  // Localiza o lead pelo (tenant, canal, id externo) ou cria um novo.
  type LeadRow = {
    id: number;
    comando: string;
    precisa_humano: boolean;
    atendente_id: string | null;
  };
  let lead: LeadRow | null = null;

  if (canalUserId) {
    const { data } = await admin
      .from("app_leads")
      .select("id,comando,precisa_humano,atendente_id")
      .eq("tenant_id", tenantId)
      .eq("canal", canal)
      .eq("canal_user_id", canalUserId)
      .limit(1)
      .maybeSingle();
    lead = data as LeadRow | null;
  }

  if (lead) {
    const patch: Record<string, unknown> = { ultima_msg: texto, updated_at: new Date().toISOString() };
    if (meta.temperatura) patch.temperatura = meta.temperatura;
    if (typeof meta.precisa_humano === "boolean") patch.precisa_humano = meta.precisa_humano;
    if (meta.diagnostico) patch.diagnostico = meta.diagnostico;
    await admin.from("app_leads").update(patch).eq("id", lead.id);
  } else {
    const { data, error } = await admin
      .from("app_leads")
      .insert({
        tenant_id: tenantId,
        nome: contato.nome || canalUserId || "Novo lead",
        telefone: contato.telefone || null,
        email: contato.email || null,
        origem: body?.origem || "site",
        canal,
        canal_user_id: canalUserId || null,
        temperatura: meta.temperatura || "frio",
        coluna: "entrada",
        ultima_msg: texto,
        precisa_humano: typeof meta.precisa_humano === "boolean" ? meta.precisa_humano : false,
        diagnostico: meta.diagnostico || null,
      })
      .select("id,comando,precisa_humano,atendente_id")
      .single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    lead = data as LeadRow;
  }

  const { error: errM } = await admin
    .from("app_mensagens")
    .insert({ tenant_id: tenantId, lead_id: lead!.id, autor, texto });
  if (errM) return NextResponse.json({ erro: errM.message }, { status: 500 });

  // CÉREBRO NO APP (Opção A): se foi mensagem do lead e não há humano no comando,
  // o SDR de IA responde (persona + RAG) e entrega pelo canal (dispatchOutbound).
  // executarSDR revalida handoff, agente_ativo e a chave da IA internamente.
  let resposta = "";
  let acionado = false;
  if (autor === "lead" && !lead!.atendente_id) {
    acionado = true;
    try {
      const r = await executarSDR(tenantId, lead!.id);
      resposta = r.resposta;
    } catch {
      // best-effort: falha do cérebro não invalida o registro da mensagem
    }
  }

  return NextResponse.json({
    ok: true,
    leadId: lead!.id,
    comando: lead!.comando,
    precisaHumano: lead!.precisa_humano,
    humanoAtivo: !!lead!.atendente_id,
    acionado,
    resposta,
  });
}
