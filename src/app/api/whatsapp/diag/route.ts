import { NextRequest, NextResponse } from "next/server";
import { getCrmAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico do webhook da Evolution (temporário, autenticado por token).
 * GET /api/whatsapp/diag?t=<ingest_token>
 * Mostra o webhook atual, tenta setar (vários formatos) e relê o resultado.
 */
export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("t") || "").trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  const base = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY || "";
  if (!base || !key) return NextResponse.json({ erro: "evolution nao configurada" }, { status: 500 });

  const admin = getCrmAdmin();
  const { data: secret } = await admin
    .from("app_tenant_secrets")
    .select("evolution_instance")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!secret?.evolution_instance)
    return NextResponse.json({ erro: "tenant/instancia nao encontrados" }, { status: 401 });
  const instancia = secret.evolution_instance as string;

  const inbound = `${(process.env.APP_PUBLIC_URL || "https://www.app.lolze.com.br").replace(/\/+$/, "")}/api/whatsapp/inbound?t=${token}`;

  async function call(method: string, path: string, body?: unknown) {
    try {
      const r = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", apikey: key },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const txt = await r.text();
      let json: unknown = null;
      try {
        json = txt ? JSON.parse(txt) : null;
      } catch {
        json = txt.slice(0, 300);
      }
      return { status: r.status, json };
    } catch (e) {
      return { status: 0, erro: (e as Error).message };
    }
  }

  const events = ["MESSAGES_UPSERT"];
  const formatos: Record<string, unknown>[] = [
    { webhook: { enabled: true, url: inbound, webhookByEvents: false, webhookBase64: false, events } },
    { enabled: true, url: inbound, webhookByEvents: false, events },
    { url: inbound, webhook_by_events: false, events },
  ];

  const antes = await call("GET", `/webhook/find/${encodeURIComponent(instancia)}`);
  const tentativas: unknown[] = [];
  for (const f of formatos) {
    const res = await call("POST", `/webhook/set/${encodeURIComponent(instancia)}`, f);
    tentativas.push({ enviado: f, resposta: res });
    if (res.status >= 200 && res.status < 300) break;
  }
  const depois = await call("GET", `/webhook/find/${encodeURIComponent(instancia)}`);
  const estado = await call("GET", `/instance/connectionState/${encodeURIComponent(instancia)}`);

  return NextResponse.json({ instancia, inbound, antes, tentativas, depois, estado });
}
