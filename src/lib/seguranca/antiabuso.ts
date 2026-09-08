import { headers } from "next/headers";

// dentroDoLimite mora em ./rate (sem next/headers) pra poder ser usado em código
// que entra no grafo de Client Component. Re-exportado aqui pelos callers atuais.
export { dentroDoLimite } from "./rate";

/**
 * Anti-abuso para superfícies PÚBLICAS (cadastro, quiz da landing).
 * Server-only (usa next/headers + service-role). Fail-open: nunca trava
 * um usuário legítimo por erro de infra.
 */

/** IP do cliente a partir dos headers da Vercel. */
export async function ipDoCliente(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return (fwd.split(",")[0].trim() || "desconhecido").slice(0, 60);
    return (h.get("x-real-ip") || "desconhecido").slice(0, 60);
  } catch {
    return "desconhecido";
  }
}

/** Campo isca: bot preenche, humano não vê. true = veio de bot. */
export function honeypot(valor?: string): boolean {
  return (valor ?? "").trim().length > 0;
}

