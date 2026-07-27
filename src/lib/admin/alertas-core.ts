/**
 * Central de alertas proativos do superadmin (dossiê §10: "alertas que não
 * dependam apenas de exceções"). Núcleo PURO, sem I/O — recebe os sinais já
 * lidos de cada tenant e classifica em alertas com severidade. A leitura fica
 * em alertas-data.ts.
 *
 * A ideia: em vez de esperar um erro aparecer no log, olhar o ESTADO de cada
 * cliente e sinalizar o que precisa de ação (IA sem canal, mensagens não
 * entregues, custo perto do teto...).
 */

export type SinalTenant = {
  tenantId: string;
  nome: string;
  agenteAtivo: boolean;
  whatsappConectado: boolean;
  instagramConfigurado: boolean;
  errosAltos24h: number;
  deadLetters: number; // mensagens status='morta' (outbox esgotou reenvios)
  custoCents: number; // custo de IA no mês
  tetoCents: number; // teto do plano (0 = ilimitado)
};

export type Severidade = "critico" | "atencao";

export type Alerta = {
  tenantId: string;
  nome: string;
  tipo: string;
  severidade: Severidade;
  mensagem: string;
};

export type ResumoAlertas = {
  alertas: Alerta[];
  criticos: number;
  atencao: number;
  tenantsComAlerta: number;
};

/** A partir de que fração do teto de custo já vale alertar. */
export const PCT_TETO_ALERTA = 0.8;

export function classificarAlertas(sinais: SinalTenant[]): ResumoAlertas {
  const alertas: Alerta[] = [];
  const add = (s: SinalTenant, tipo: string, sev: Severidade, mensagem: string) =>
    alertas.push({ tenantId: s.tenantId, nome: s.nome, tipo, severidade: sev, mensagem });

  for (const s of sinais) {
    // Crítico: IA ligada mas sem NENHUM canal para responder → clientes no vácuo.
    if (s.agenteAtivo && !s.whatsappConectado && !s.instagramConfigurado) {
      add(s, "sem_canal", "critico", "IA ativa, mas sem canal conectado — não consegue responder");
    }
    // Crítico: mensagens que esgotaram os reenvios (dead-letter do outbox).
    if (s.deadLetters > 0) {
      add(s, "dead_letter", "critico", `${s.deadLetters} mensagem(ns) não entregue(s) (dead-letter)`);
    }
    // Custo: crítico se estourou o teto; atenção se passou de PCT_TETO_ALERTA.
    if (s.tetoCents > 0 && s.custoCents >= s.tetoCents * PCT_TETO_ALERTA) {
      const pct = Math.round((s.custoCents / s.tetoCents) * 100);
      const estourou = s.custoCents >= s.tetoCents;
      add(
        s,
        "custo_teto",
        estourou ? "critico" : "atencao",
        estourou ? `Custo de IA estourou o teto do plano (${pct}%)` : `Custo de IA em ${pct}% do teto do plano`
      );
    }
    // Atenção: IA desligada (pode ser intencional, mas o superadmin deve saber).
    if (!s.agenteAtivo) {
      add(s, "agente_off", "atencao", "IA desligada — não está atendendo");
    }
    // Atenção: erros de severidade alta nas últimas 24h.
    if (s.errosAltos24h > 0) {
      add(s, "erros", "atencao", `${s.errosAltos24h} erro(s) de severidade alta nas últimas 24h`);
    }
  }

  // Críticos primeiro; dentro do mesmo grupo, preserva a ordem de inserção.
  alertas.sort((a, b) => (a.severidade === "critico" ? 0 : 1) - (b.severidade === "critico" ? 0 : 1));

  const criticos = alertas.filter((a) => a.severidade === "critico").length;
  return {
    alertas,
    criticos,
    atencao: alertas.length - criticos,
    tenantsComAlerta: new Set(alertas.map((a) => a.tenantId)).size,
  };
}
