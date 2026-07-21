import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, temChaveIA, ROUTER_MODEL } from "@/lib/agent/anthropic";
import { registrarFunilLolze } from "@/lib/funil-lolze";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chat de DEMONSTRAÇÃO da landing (público, sem login).
 * Deixa o visitante testar a velocidade do agente da Lolze ali mesmo.
 *
 * Blindagem contra abuso/custo:
 * - Modelo barato (Haiku) + max_tokens curto.
 * - Limite de turnos por conversa (acima disso, responde um convite e PARA).
 * - Mensagens truncadas e histórico limitado.
 * - Limitador simples por IP (best-effort; em produção séria, trocar por KV).
 */

const MAX_TURNOS = 7; // perguntas do visitante antes de encerrar o demo
const MAX_CHARS = 400; // por mensagem
const MAX_HIST = 14; // últimas mensagens consideradas

// Limitador por IP (best-effort; reinicia a cada instância serverless).
const HITS = new Map<string, { n: number; t: number }>();
const JANELA_MS = 60_000;
const MAX_POR_JANELA = 30;

function limitado(ip: string): boolean {
  const agora = Date.now();
  const reg = HITS.get(ip);
  if (!reg || agora - reg.t > JANELA_MS) {
    HITS.set(ip, { n: 1, t: agora });
    return false;
  }
  reg.n += 1;
  return reg.n > MAX_POR_JANELA;
}

const SYSTEM = `Você é o agente de IA da Lolze demonstrando AO VIVO, numa landing page, como atende clientes no WhatsApp. Está conversando com um DONO DE NEGÓCIO de serviço com agenda (clínica, estética, lava-jato, academia, advocacia, pet shop) que veio TESTAR a sua velocidade e talvez tentar te desviar do assunto.

Seu objetivo é mostrar, na prática, como você conduz qualquer conversa de volta para o próximo passo: aplicar para uma Sessão Estratégica gratuita da Lolze.

Regras:
- Responda em 1 a 3 frases curtas, humano, direto e confiante. Português do Brasil.
- Se a pessoa te desviar do tema, reconheça com leveza e traga de volta pro negócio dela.
- Nunca invente preço fechado da Lolze nem prometa número garantido.
- Ao perceber interesse, convide a clicar em "Quero aplicar" / preencher a aplicação.
- Você é a prova viva do produto: seja rápido e impecável.`;

const ENCERRAMENTO =
  "Curti demais nosso papo! 🙌 Pra valer mesmo — com os seus serviços e a sua agenda reais — bora uma conversa de verdade. Clica em *Quero aplicar* aqui em cima que eu te mostro tudo.";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (limitado(ip)) {
    return NextResponse.json({
      reply: "Opa, muita mensagem rápida! Respira um segundinho e manda de novo. 😉",
    });
  }

  const bruto = (body as { messages?: unknown })?.messages;
  const lista = Array.isArray(bruto) ? bruto : [];

  // Sanitiza: só user/assistant, conteúdo string truncado, e começa em 'user'.
  const limpo: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of lista.slice(-MAX_HIST)) {
    const role = (m as { role?: string })?.role;
    const content = String((m as { content?: unknown })?.content ?? "").slice(0, MAX_CHARS).trim();
    if ((role === "user" || role === "assistant") && content) {
      limpo.push({ role, content });
    }
  }
  const primeiroUser = limpo.findIndex((m) => m.role === "user");
  const msgs = primeiroUser >= 0 ? limpo.slice(primeiroUser) : [];

  if (msgs.length === 0) {
    return NextResponse.json({ reply: "Me conta: qual é o seu tipo de negócio? 😊" });
  }

  const turnos = msgs.filter((m) => m.role === "user").length;

  // Funil da Lolze: uso do demo (o 1º turno marca "experimentou a IA").
  await registrarFunilLolze("demo_mensagem", { turno: turnos });

  if (turnos > MAX_TURNOS) {
    return NextResponse.json({ reply: ENCERRAMENTO, encerrado: true });
  }

  if (!temChaveIA()) {
    return NextResponse.json({
      reply:
        "Funciono em segundos, treinada pro seu negócio, 24/7. Bora ver isso de verdade? Clica em *Quero aplicar*. 🚀",
    });
  }

  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: ROUTER_MODEL, // Haiku — rápido e barato para o demo público
      max_tokens: 250,
      system: SYSTEM,
      messages: msgs as Anthropic.MessageParam[],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const reply =
      res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join(" ")
        .trim() || "Bora agendar isso pra valer? Clica em *Quero aplicar*. 🚀";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({
      reply:
        "Tive um soluço aqui agora 😅 — mas na sua operação real eu rodo redondinho. Clica em *Quero aplicar* que a gente conversa.",
    });
  }
}
