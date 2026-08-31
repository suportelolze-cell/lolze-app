"use server";

import { getSessao } from "@/lib/supabase/tenant";
import { registrarErro, type Severidade } from "./erros";

/**
 * Ponte do cliente para o registro central de erros. Chamada por Server Action
 * a partir do navegador (error boundary + listeners globais). O tenant vem SEMPRE
 * da sessão do servidor (nunca do cliente). Best-effort: nunca lança.
 */
export async function registrarErroCliente(input: {
  contexto?: string;
  mensagem: string;
  detalhe?: string;
  rota?: string;
  severidade?: Severidade;
}): Promise<void> {
  try {
    const s = await getSessao();
    const mensagem = (input.mensagem || "erro sem mensagem").slice(0, 500);
    const rota = (input.rota || "").slice(0, 200);
    const corpo = [rota ? `rota: ${rota}` : "", (input.detalhe || "").slice(0, 3500)]
      .filter(Boolean)
      .join("\n");

    // registrarErro extrai message/stack de um Error — montamos um com o detalhe.
    const e = new Error(mensagem);
    if (corpo) e.stack = corpo;

    await registrarErro({
      tenantId: s.tenantId,
      contexto: (input.contexto || "cliente").slice(0, 80),
      erro: e,
      // Padrão baixo: erro de cliente é mais ruidoso; não dispara alerta de ops
      // (só severidade "alta" avisa o WhatsApp). O boundary de render usa "media".
      severidade: input.severidade ?? "baixa",
      janelaAlertaMin: 60,
    });
  } catch {
    /* nunca pode quebrar quem chamou */
  }
}
