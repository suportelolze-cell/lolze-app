import type { ColunaId, Temperatura } from "@/lib/leads";

/** Identidade + persona do negócio (lida de app_config). Campos persona são opcionais. */
export type PersonaConfig = {
  nomeNegocio: string;
  endereco: string;
  email: string;
  horario: string;
  // Persona do agente (colunas opcionais — degradam se ausentes no banco).
  oferta: string;
  publico: string;
  tom: string;
  regras: string;
  objecoes: string;
  faq: string;
  agenteAtivo: boolean;
};

/** Uma mensagem do histórico da conversa. */
export type Turno = {
  autor: "lead" | "ia" | "atendente";
  texto: string;
};

/** Estado do lead que o SDR precisa para decidir. */
export type LeadContexto = {
  id: number;
  nome: string;
  canal: string;
  origem: string;
  temperatura: Temperatura;
  coluna: ColunaId;
  diagnostico: string;
};

/** Mutações que o SDR pode aplicar no lead durante um turno. */
export type AcaoSDR =
  | { tipo: "definir_temperatura"; temperatura: Temperatura; motivo?: string }
  | { tipo: "mover_etapa"; etapa: ColunaId; motivo?: string }
  | { tipo: "registrar_diagnostico"; resumo: string }
  | { tipo: "escalar_humano"; motivo?: string };

/** Resultado de uma execução do agente. */
export type ResultadoAgente = {
  ok: boolean;
  resposta: string;
  acoes: AcaoSDR[];
  skipped?: "humano" | "agente_inativo" | "sem_chave" | "limite_ia";
  erro?: string;
  uso?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreation: number;
    cacheRead: number;
  };
  latenciaMs?: number;
};
