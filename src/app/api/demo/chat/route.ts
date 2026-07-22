import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, temChaveIA, ROUTER_MODEL } from "@/lib/agent/anthropic";
import { registrarFunilLolze } from "@/lib/funil-lolze";
import { dentroDoLimite } from "@/lib/seguranca/antiabuso";
import { sanitizarMensagensDemo, contarTurnos, MAX_TURNOS } from "@/lib/demo/sanitizar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chat de DEMONSTRAÇÃO da landing (público, sem login).
 * Deixa o visitante testar a velocidade do agente da Lolze ali mesmo.
 *
 * Blindagem contra abuso/custo (endpoint público que chama modelo pago):
 * - Modelo barato (Haiku) + max_tokens curto + histórico/mensagem truncados
 *   (cada chamada custa centavos).
 * - TETO DIÁRIO por IP no BANCO (app_rate_hits) — sobrevive entre instâncias
 *   serverless, então o custo total por visitante é limitado de verdade (o cap
 *   de turnos sozinho não bastava: o cliente controla o array de mensagens).
 * - Pré-filtro de rajada em memória (barato, sem ida ao banco).
 */

// Teto persistente por IP (o que realmente limita o custo).
const MAX_POR_DIA = 60; // chamadas ao modelo por IP a cada 24h
// Pré-filtro de rajada em memória (absorve spam rápido de uma mesma instância).
const HITS = new Map<string, { n: number; t: number }>();
const JANELA_MS = 60_000;
const MAX_POR_JANELA = 20;

function rajada(ip: string): boolean {
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

  // 1) Pré-filtro de rajada (memória, barato).
  if (rajada(ip)) {
    return NextResponse.json({
      reply: "Opa, muita mensagem rápida! Respira um segundinho e manda de novo. 😉",
    });
  }

  // 2) Teto diário por IP no banco — só depois disso gasta modelo/registra funil.
  if (!(await dentroDoLimite("demo_dia", ip, MAX_POR_DIA, 86_400))) {
    return NextResponse.json({ reply: ENCERRAMENTO, encerrado: true });
  }

  // Sanitiza: só user/assistant, conteúdo truncado, e começa em 'user'.
  const msgs = sanitizarMensagensDemo((body as { messages?: unknown })?.messages);

  if (msgs.length === 0) {
    return NextResponse.json({ reply: "Me conta: qual é o seu tipo de negócio? 😊" });
  }

  const turnos = contarTurnos(msgs);
  if (turnos > MAX_TURNOS) {
    return NextResponse.json({ reply: ENCERRAMENTO, encerrado: true });
  }

  // Funil da Lolze: uso do demo (só após passar pelos limites, pra não inflar).
  await registrarFunilLolze("demo_mensagem", { turno: turnos });

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
