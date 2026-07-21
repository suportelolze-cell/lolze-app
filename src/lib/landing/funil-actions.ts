"use server";

import { registrarFunilLolze } from "@/lib/funil-lolze";
import { ipDoCliente, dentroDoLimite } from "@/lib/seguranca/antiabuso";

/**
 * Eventos de funil disparados do CLIENT da landing (superfície pública).
 * Throttle por IP para não virar lixo; o client ainda deduplica por sessão.
 */
export async function registrarDiagnosticoLanding(): Promise<void> {
  if (!(await dentroDoLimite("funil_diag", await ipDoCliente(), 6, 3600))) return;
  await registrarFunilLolze("diagnostico_interagido");
}
