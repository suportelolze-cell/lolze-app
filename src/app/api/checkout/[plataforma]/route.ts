import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability/erros";
import { getAdapter } from "@/lib/checkout";
import { ingerirVenda } from "@/lib/checkout/ingestao";
import { decifrar } from "@/lib/checkout/cripto";

export const dynamic = "force-dynamic";

/**
 * Webhook de checkout (Ticto / Hotmart / Kiwify). Normaliza a venda e alimenta
 * o CRM do tenant. Fica DARK enquanto nenhum tenant tem integração configurada.
 *
 * Confiabilidade (P0), no mesmo padrão do webhook do Stripe:
 * - Autentica por token na URL (?t=...) que resolve o tenant + plataforma, e
 *   depois VALIDA a assinatura/segredo da plataforma. Token/assinatura inválidos
 *   → 401 (não cria nada).
 * - IDEMPOTENTE por (tenant, plataforma, external_id, evento): retentativa do
 *   provedor não duplica venda.
 * - Falha de banco → 5xx para o provedor RETENTAR (nada se perde em silêncio).
 * - Payload malformado / evento irrelevante → 200 (ignora, sem storm de retry).
 *
 * URL por integração:
 *   /api/checkout/<plataforma>?t=<ingest_token>
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ plataforma: string }> }) {
  const { plataforma } = await ctx.params;
  const adapter = getAdapter(plataforma);
  if (!adapter) return NextResponse.json({ erro: "plataforma desconhecida" }, { status: 404 });

  const token = (req.nextUrl.searchParams.get("t") || "").trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  // Corpo cru primeiro (algumas plataformas assinam o corpo exato, ex.: Kiwify).
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignorado: "json" });
  }

  let admin: ReturnType<typeof getCrmAdmin>;
  try {
    admin = getCrmAdmin();
  } catch {
    return NextResponse.json({ erro: "servico indisponivel" }, { status: 500 });
  }

  const { data: integ, error: errInteg } = await admin
    .from("app_checkout_integracoes")
    .select("tenant_id,secret,ativo")
    .eq("ingest_token", token)
    .eq("plataforma", plataforma)
    .maybeSingle();
  if (errInteg) return NextResponse.json({ erro: "banco indisponivel" }, { status: 500 });
  if (!integ || !integ.ativo) return NextResponse.json({ erro: "token invalido" }, { status: 401 });

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const autentico = adapter.validarAssinatura({
    rawBody: raw,
    headers,
    query,
    payload,
    secret: decifrar(integ.secret as string | null),
  });
  if (!autentico) return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });

  const parsed = adapter.parse(payload);
  if (!parsed.ok) return NextResponse.json({ ok: true, ignorado: parsed.motivo });

  try {
    const r = await ingerirVenda(admin, integ.tenant_id as string, plataforma, parsed.venda, payload);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    await registrarErro({
      tenantId: integ.tenant_id as string,
      contexto: `checkout.${plataforma}`,
      erro: e,
      severidade: "alta",
    });
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}
