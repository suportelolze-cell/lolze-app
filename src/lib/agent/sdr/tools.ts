import type Anthropic from "@anthropic-ai/sdk";
import type { ColunaId, Temperatura } from "@/lib/leads";
import type { AcaoSDR } from "../types";

/**
 * Ferramentas do SDR (executadas pelo nosso orquestrador, não pela Anthropic).
 * Cada chamada vira uma mutação no app_leads + um registro em `acoes`.
 */

// Etapas que o SDR pode definir. Não inclui "entrada" (chegada) nem "ganho"
// (pagamento confirmado é decisão humana). "atencao" é setado via escalar_humano.
const ETAPAS_SDR: ColunaId[] = ["qualificacao", "agendado", "perdido"];
const TEMPERATURAS: Temperatura[] = ["quente", "morno", "frio"];

export const SDR_TOOLS: Anthropic.Tool[] = [
  {
    name: "definir_temperatura",
    description:
      "Classifica o lead com base no interesse, urgência e fit com a oferta. " +
      "Use 'quente' quando demonstra forte intenção de comprar/agendar, 'morno' " +
      "quando tem interesse mas ainda há objeções, 'frio' quando é curiosidade " +
      "ou fora do perfil. Sempre reavalie a cada resposta relevante do lead.",
    input_schema: {
      type: "object",
      properties: {
        temperatura: { type: "string", enum: TEMPERATURAS },
        motivo: { type: "string", description: "Por que esta temperatura (1 frase)." },
      },
      required: ["temperatura"],
    },
  },
  {
    name: "mover_etapa",
    description:
      "Move o lead no funil. 'qualificacao' enquanto você ainda conversa/filtra; " +
      "'agendado' SOMENTE depois que o lead confirmar um horário; 'perdido' quando " +
      "está desqualificado, sem orçamento, ou pediu para não ser mais contatado.",
    input_schema: {
      type: "object",
      properties: {
        etapa: { type: "string", enum: ETAPAS_SDR },
        motivo: { type: "string", description: "Por que mover (1 frase)." },
      },
      required: ["etapa"],
    },
  },
  {
    name: "registrar_diagnostico",
    description:
      "Salva um resumo curto do que você descobriu sobre o lead (dor, desejo, " +
      "urgência, orçamento) para que o atendente humano assuma sem reler tudo. " +
      "Atualize sempre que aprender algo novo e relevante.",
    input_schema: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "Resumo objetivo, até 2 frases." },
      },
      required: ["resumo"],
    },
  },
  {
    name: "escalar_humano",
    description:
      "Aciona um atendente humano e pausa a IA. Use quando o lead está pronto para " +
      "fechar e pede para falar com pessoa, quando a objeção exige negociação humana, " +
      "ou diante de reclamação/risco. Após escalar, envie uma mensagem curta avisando " +
      "que um especialista vai assumir em instantes.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por que escalar agora (1 frase)." },
      },
      required: ["motivo"],
    },
  },
  {
    name: "agendar_reuniao",
    description:
      "Cria o agendamento quando o lead CONFIRMAR um horário específico. Antes de chamar, " +
      "confirme com o lead a data e a hora. Passe 'inicio' em ISO 8601 com fuso " +
      "(ex.: 2026-06-21T15:00:00-03:00), calculado a partir da 'Data e hora agora' do contexto. " +
      "O agendamento aparece na Agenda do painel e move o lead para 'agendado'.",
    input_schema: {
      type: "object",
      properties: {
        inicio: {
          type: "string",
          description: "Data e hora de início em ISO 8601 com fuso -03:00.",
        },
        duracao_min: { type: "number", description: "Duração em minutos (padrão 60)." },
        servico: { type: "string", description: "Serviço/assunto da reunião." },
        nome: { type: "string", description: "Nome do lead, se souber." },
      },
      required: ["inicio"],
    },
  },
  {
    name: "adiar_contato",
    description:
      "Use quando o lead demonstrar interesse mas pedir para falar depois ('agora não', " +
      "'me chama mês que vem', 'estou sem caixa', 'depois eu vejo'). NÃO é uma recusa. " +
      "Agenda uma reativação automática para voltar a falar com ele no futuro. Informe " +
      "'dias' (ex.: 15, 30) conforme o que o lead disser; se ele não der prazo, use 15.",
    input_schema: {
      type: "object",
      properties: {
        dias: { type: "number", description: "Em quantos dias retomar o contato (padrão 15)." },
        motivo: { type: "string", description: "O que o lead disse (1 frase)." },
      },
      required: [],
    },
  },
  {
    name: "encerrar_lead",
    description:
      "Use SOMENTE quando o lead recusar de forma definitiva ('não quero', 'não tenho " +
      "interesse', 'pare de me mandar mensagem', 'descadastrar'). Encerra o lead e para " +
      "qualquer follow-up automático. Não use para 'depois' ou 'estou ocupado' (use adiar_contato).",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo da recusa (1 frase)." },
      },
      required: [],
    },
  },
  {
    name: "buscar_conhecimento",
    description:
      "Consulta a base de conhecimento da empresa (documentos, tabela de preços, FAQ, " +
      "políticas, regras, detalhes dos serviços). Use SEMPRE antes de responder qualquer " +
      "pergunta sobre preço, serviço, processo, política ou detalhe específico do negócio. " +
      "Nunca invente — busque aqui primeiro.",
    input_schema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description:
            "O que buscar, em poucas palavras (ex.: 'preço da harmonização', 'política de cancelamento').",
        },
      },
      required: ["consulta"],
    },
  },
];

/** Patch acumulado para o app_leads + lista de ações para log/retorno. */
export type SdrPatch = {
  patch: Record<string, unknown>;
  acoes: AcaoSDR[];
  /** true quando uma tool já decidiu o follow-up (adiar/encerrar/escalar). */
  followupDefinido?: boolean;
};

/** Aplica uma chamada de ferramenta ao acumulador. Retorna a confirmação p/ o modelo. */
export function aplicarToolSDR(
  nome: string,
  input: Record<string, unknown>,
  acc: SdrPatch
): string {
  switch (nome) {
    case "definir_temperatura": {
      const temperatura = String(input.temperatura) as Temperatura;
      if (!TEMPERATURAS.includes(temperatura)) return "Erro: temperatura inválida.";
      acc.patch.temperatura = temperatura;
      acc.acoes.push({ tipo: "definir_temperatura", temperatura, motivo: input.motivo as string });
      return `Temperatura definida como ${temperatura}.`;
    }
    case "mover_etapa": {
      const etapa = String(input.etapa) as ColunaId;
      if (!ETAPAS_SDR.includes(etapa)) return "Erro: etapa não permitida ao SDR.";
      acc.patch.coluna = etapa;
      acc.acoes.push({ tipo: "mover_etapa", etapa, motivo: input.motivo as string });
      return `Lead movido para ${etapa}.`;
    }
    case "registrar_diagnostico": {
      const resumo = String(input.resumo || "").trim();
      if (!resumo) return "Erro: resumo vazio.";
      acc.patch.diagnostico = resumo;
      acc.acoes.push({ tipo: "registrar_diagnostico", resumo });
      return "Diagnóstico salvo.";
    }
    case "escalar_humano": {
      acc.patch.precisa_humano = true;
      acc.patch.coluna = "atencao";
      acc.patch.proximo_followup = null; // humano assume → para o follow-up automático
      acc.followupDefinido = true;
      acc.acoes.push({ tipo: "escalar_humano", motivo: input.motivo as string });
      return "Atendente humano acionado. Envie uma mensagem curta de transição ao lead.";
    }
    case "adiar_contato": {
      const dias = Math.max(1, Math.round(Number(input.dias) || 15));
      acc.patch.proximo_followup = new Date(Date.now() + dias * 86400000).toISOString();
      acc.patch.followup_modo = "reativacao";
      acc.patch.followup_count = 0;
      acc.patch.temperatura = "frio";
      acc.followupDefinido = true;
      acc.acoes.push({ tipo: "registrar_diagnostico", resumo: `Adiado ${dias}d: ${String(input.motivo ?? "")}` });
      return `Contato adiado por ${dias} dias (reativação automática agendada).`;
    }
    case "encerrar_lead": {
      acc.patch.coluna = "perdido";
      acc.patch.proximo_followup = null;
      acc.patch.followup_modo = null;
      acc.followupDefinido = true;
      acc.acoes.push({ tipo: "mover_etapa", etapa: "perdido", motivo: input.motivo as string });
      return "Lead encerrado. Nenhum follow-up será enviado.";
    }
    default:
      return `Erro: ferramenta desconhecida (${nome}).`;
  }
}
