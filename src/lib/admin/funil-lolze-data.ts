import { getCrmAdmin } from "@/lib/supabase/admin";
import { exigirSuperadmin } from "./data";
import {
  resumirFunilLolze,
  normalizarJanelaFunil,
  type LinhaFunilLolze,
  type FunilLolzeResumo,
} from "./funil-lolze-core";

/**
 * Painel do funil INTERNO da Lolze (P1.4, parte de leitura). Só superadmin.
 * Fonte: app_funil_lolze (tabela global, sem tenant_id — é a jornada de
 * aquisição da própria Lolze). Usa service_role atrás do gate de superadmin,
 * porque é tabela de bastidor. A matemática vive em funil-lolze-core.ts (pura).
 */

export type { FunilLolzeResumo } from "./funil-lolze-core";

export type EventoRecente = { id: number; evento: string; quando: string; resumo: string };

const ROTULO_EVENTO: Record<string, string> = {
  diagnostico_interagido: "Diagnóstico usado",
  demo_mensagem: "Mensagem no demo",
  aplicacao_enviada: "Aplicação enviada",
  cadastro_criado: "Cadastro criado",
  checkout_iniciado: "Checkout iniciado",
  pagamento_confirmado: "Pagamento confirmado",
  onboarding_concluido: "Ativação (onboarding)",
};

function resumoDados(evento: string, dados: Record<string, unknown> | null): string {
  const d = dados ?? {};
  if (evento === "demo_mensagem" && d.turno != null) return `turno ${d.turno}`;
  if (evento === "aplicacao_enviada" && d.negocio) return String(d.negocio);
  if (evento === "cadastro_criado" && d.plano) return `plano ${d.plano}`;
  if (evento === "checkout_iniciado" && d.plano) return `plano ${d.plano}`;
  return "";
}

/** Resumo agregado do funil (topo + jornada) na janela pedida. */
export async function getFunilLolze(dias: number | null = null): Promise<FunilLolzeResumo> {
  await exigirSuperadmin();
  const janela = normalizarJanelaFunil(dias);

  const admin = getCrmAdmin();
  let q = admin.from("app_funil_lolze").select("evento,created_at,dados");
  if (janela != null) {
    const corte = new Date();
    corte.setDate(corte.getDate() - janela);
    q = q.gte("created_at", corte.toISOString());
  }
  const { data } = await q;
  return resumirFunilLolze((data as LinhaFunilLolze[] | null) ?? [], janela);
}

/** Últimos eventos do funil (para dar textura ao painel). */
export async function getFunilLolzeRecentes(limite = 20): Promise<EventoRecente[]> {
  await exigirSuperadmin();
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_funil_lolze")
    .select("id,evento,created_at,dados")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limite, 1), 100));

  return ((data as { id: number; evento: string; created_at: string; dados: Record<string, unknown> | null }[] | null) ?? []).map(
    (r) => ({
      id: r.id,
      evento: ROTULO_EVENTO[r.evento] ?? r.evento,
      quando: r.created_at,
      resumo: resumoDados(r.evento, r.dados),
    })
  );
}
