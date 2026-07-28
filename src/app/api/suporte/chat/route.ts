import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getSessao } from "@/lib/supabase/tenant";
import { getAnthropic, temChaveIA, ROUTER_MODEL } from "@/lib/agent/anthropic";
import { dentroDoLimite } from "@/lib/seguranca/antiabuso";
import { sanitizarMensagensDemo } from "@/lib/demo/sanitizar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Assistente de SUPORTE da Lolze (1ª linha), dentro do painel do cliente logado.
 * Tira dúvidas de USO da plataforma; o que não resolver, escala para o humano
 * (WhatsApp). Custo é da Lolze (não conta no teto de IA do tenant) — por isso
 * modelo barato (Haiku), max_tokens curto e teto diário por tenant no banco.
 */
const MAX_POR_DIA = 100; // perguntas ao suporte por tenant a cada 24h

const SYSTEM = `Você é o Assistente de Suporte da Lolze — uma IA que ajuda o DONO DO NEGÓCIO (cliente da Lolze, já logado no painel) a USAR a plataforma. Fale em português do Brasil, cordial, direto e objetivo (1 a 4 frases; use passos numerados quando ensinar um caminho).

O QUE É A LOLZE: uma central comercial com IA que atende os clientes do usuário no WhatsApp/Instagram, qualifica, agenda e passa para um humano quando preciso — com CRM, agenda e relatórios.

COMO A PLATAFORMA FUNCIONA (use para responder "como faço X"):
- "Hoje": tela inicial com o que precisa de ação (leads quentes sem resposta, agendamentos sem confirmação, mensagens que falharam, clientes para reativar).
- "Central de Atendimento": a caixa de entrada das conversas; a IA responde sozinha e o usuário pode assumir uma conversa (handoff) a qualquer momento.
- "Pipeline" (CRM/Kanban): arrasta os leads pelas etapas até fechar.
- "Agenda Mágica": agendamentos, confirmações e lembretes anti-falta.
- "Configurações": onde ajusta tudo. Abas:
   • Identidade do Negócio (nome, endereço, horário) e respostas rápidas.
   • Integrações e APIs (conectar WhatsApp/Instagram, Google Agenda; ligar/desligar a IA).
   • Base de Conhecimento: aqui o cliente BAIXA UM MODELO (.txt), preenche com serviços/preços/durações/regras e ENVIA — é o que deixa a IA precisa. Aceita PDF, TXT, MD, CSV.
   • Gestão de Equipe (adicionar/remover usuários).
   • Faturamento e Plano (assinatura, trocar plano, portal do Stripe).
- Pausa de emergência: em Configurações → Integrações dá para DESLIGAR a IA na hora (ela para de responder até religar).
- Ensinar a IA a atender melhor: preencher bem a Base de Conhecimento e as regras/objeções/FAQ no onboarding ou nas Configurações.

REGRAS:
- Ajude a RESOLVER a dúvida de uso com passos claros. Não invente telas ou botões que você não conhece; se não souber, admita.
- ESCALE para um humano (peça para o usuário clicar em "Falar com uma pessoa", que abre o WhatsApp do suporte, Seg a Sex 9h–18h, resposta em até 1 dia útil) quando: for um BUG/erro do sistema, cobrança/pagamento com problema, algo urgente que você não resolve, ou quando o usuário pedir para falar com uma pessoa.
- Nunca prometa resultado garantido nem invente preço. Não peça senha nem dado de cartão.`;

export async function POST(req: NextRequest) {
  const s = await getSessao();
  if (!s.tenantId) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  // Teto diário por tenant (protege o custo do suporte, que é da Lolze).
  if (!(await dentroDoLimite("suporte_dia", s.tenantId, MAX_POR_DIA, 86_400))) {
    return NextResponse.json({
      reply:
        "Você já usou bastante o assistente hoje 🙂 Para continuar, fale com a nossa equipe no WhatsApp (botão *Falar com uma pessoa*).",
    });
  }

  const msgs = sanitizarMensagensDemo((body as { messages?: unknown })?.messages);
  if (msgs.length === 0) {
    return NextResponse.json({
      reply: "Oi! Sou o assistente da Lolze 👋 Como posso te ajudar a usar a plataforma?",
    });
  }

  if (!temChaveIA()) {
    return NextResponse.json({
      reply:
        "No momento não consigo responder por aqui. Fale com a nossa equipe no WhatsApp (botão *Falar com uma pessoa*).",
    });
  }

  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: msgs as Anthropic.MessageParam[],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const reply =
      res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join(" ")
        .trim() ||
      "Não consegui te ajudar com isso agora — melhor falar com a nossa equipe no WhatsApp (botão *Falar com uma pessoa*).";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({
      reply:
        "Tive um probleminha aqui 😅 Se for urgente, fale com a nossa equipe no WhatsApp (botão *Falar com uma pessoa*).",
    });
  }
}
