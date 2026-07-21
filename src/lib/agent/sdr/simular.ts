import type Anthropic from "@anthropic-ai/sdk";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getAnthropic, temChaveIA, SDR_MODEL } from "../anthropic";
import { montarSystemSDR } from "./prompt";
import { SDR_TOOLS, aplicarToolSDR, type SdrPatch } from "./tools";
import { buscarConhecimento } from "@/lib/kb/search";
import { consultarDisponibilidade } from "./disponibilidade";
import { carregarConfig } from "./run";
import { registrarUsoIA } from "../uso";
import { dentroDoLimiteIA } from "../limite";
import type { LeadContexto } from "../types";

/**
 * SIMULAÇÃO do SDR — bateria de testes da implantação (dossiê P1.5).
 *
 * Roda o MESMO cérebro (persona + RAG + agenda) do tenant, mas em modo seguro:
 * - NÃO grava mensagens, NÃO entrega em canal, NÃO altera lead/funil.
 * - buscar_conhecimento e consultar_disponibilidade executam DE VERDADE
 *   (testam a base e a agenda reais); agendar_reuniao é interceptado e
 *   respondido como simulação (nada é criado).
 * - O custo de IA conta no teto do tenant (teste é uso real de modelo).
 */

export type ResultadoSimulacao = {
  ok: boolean;
  resposta: string;
  acoes: string[];
  erro?: string;
};

const MAX_ITER = 4;

export async function simularSDR(tenantId: string, pergunta: string): Promise<ResultadoSimulacao> {
  if (!temChaveIA()) return { ok: false, resposta: "", acoes: [], erro: "ANTHROPIC_API_KEY ausente." };
  if (!(await dentroDoLimiteIA(tenantId)))
    return { ok: false, resposta: "", acoes: [], erro: "Teto de IA do mês atingido para este cliente." };

  const admin = getCrmAdmin();
  const cfg = await carregarConfig(admin, tenantId);

  const ctx: LeadContexto = {
    id: 0,
    nome: "Lead de Teste",
    canal: "whatsapp",
    origem: "site",
    temperatura: "frio",
    coluna: "entrada",
    diagnostico: "",
  };

  const system = montarSystemSDR(cfg, ctx, false);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: pergunta.trim() }];

  const client = getAnthropic();
  const acc: SdrPatch = { patch: {}, acoes: [] };
  let resposta = "";
  const uso = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };

  try {
    for (let i = 0; i < MAX_ITER; i++) {
      const res = await client.messages.create({
        model: SDR_MODEL,
        max_tokens: 1024,
        system,
        output_config: { effort: "low" },
        tools: SDR_TOOLS,
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming);

      uso.inputTokens += res.usage.input_tokens ?? 0;
      uso.outputTokens += res.usage.output_tokens ?? 0;
      uso.cacheCreation += res.usage.cache_creation_input_tokens ?? 0;
      uso.cacheRead += res.usage.cache_read_input_tokens ?? 0;

      const texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (texto) resposta = texto;

      if (res.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: res.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const args = block.input as Record<string, unknown>;
        let confirm: string;
        if (block.name === "buscar_conhecimento") {
          try {
            confirm = await buscarConhecimento(tenantId, String(args.consulta ?? ""));
          } catch (e) {
            confirm = "Base de conhecimento indisponível: " + (e as Error).message;
          }
        } else if (block.name === "consultar_disponibilidade") {
          try {
            confirm = await consultarDisponibilidade(
              tenantId,
              String(args.data ?? ""),
              Number(args.duracao_min) || undefined
            );
          } catch (e) {
            confirm = "Não consegui ler a agenda agora: " + (e as Error).message;
          }
        } else if (block.name === "agendar_reuniao") {
          // Modo teste: NADA é criado — confirma como se tivesse agendado.
          acc.acoes.push({ tipo: "mover_etapa", etapa: "agendado", motivo: "[simulação]" });
          confirm =
            "[SIMULAÇÃO] Agendamento NÃO foi criado (modo teste). Responda ao lead como se o horário estivesse confirmado.";
        } else {
          confirm = aplicarToolSDR(block.name, args, acc); // só acumula em memória
        }
        resultados.push({ type: "tool_result", tool_use_id: block.id, content: confirm });
      }
      messages.push({ role: "user", content: resultados });
    }
  } catch (e) {
    await registrarUsoIA(tenantId, uso);
    return {
      ok: false,
      resposta: "",
      acoes: [],
      erro: e instanceof Error ? e.message : "erro desconhecido",
    };
  }

  await registrarUsoIA(tenantId, uso);
  return {
    ok: true,
    resposta,
    acoes: acc.acoes.map((a) =>
      "temperatura" in a
        ? `temperatura → ${a.temperatura}`
        : "etapa" in a
          ? `etapa → ${a.etapa}`
          : "resumo" in a
            ? `diagnóstico registrado`
            : a.tipo
    ),
  };
}

/** Bateria padrão de implantação (agnóstica de nicho; refinável por segmento). */
export const BATERIA_PADRAO: { chave: string; rotulo: string; pergunta: string }[] = [
  { chave: "preco", rotulo: "Pergunta de preço", pergunta: "Oi! Quanto custa?" },
  {
    chave: "agenda",
    rotulo: "Pedido de horário",
    pergunta: "Queria marcar um horário pra amanhã à tarde, tem vaga?",
  },
  {
    chave: "oferta",
    rotulo: "Sobre o serviço",
    pergunta: "Me explica como funciona o serviço de vocês?",
  },
  {
    chave: "objecao",
    rotulo: "Objeção clássica",
    pergunta: "Achei interessante, mas vou pensar e te falo depois.",
  },
  {
    chave: "fora_escopo",
    rotulo: "Fora do escopo",
    pergunta: "Você pode me dar um conselho jurídico sobre um processo que estou respondendo?",
  },
];
