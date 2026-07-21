import { getCrmAdmin } from "@/lib/supabase/admin";
import { exigirSuperadmin } from "./data";

/**
 * Prontidão de go-live (dossiê P1.5 — implantação como CONFIGURAÇÃO padronizada).
 * Checklist computado dos DADOS REAIS do tenant (nada de marcar na mão):
 * persona, base de conhecimento, canais, agenda, onboarding e os dois marcos de
 * uso real vindos do ledger (primeira resposta da IA e primeiro agendamento).
 */

export type ItemProntidao = {
  chave: string;
  rotulo: string;
  ok: boolean;
  dica: string;
};

export type Prontidao = { itens: ItemProntidao[]; prontos: number; total: number };

export async function getProntidao(tenantId: string): Promise<Prontidao> {
  await exigirSuperadmin();
  const admin = getCrmAdmin();

  const [{ data: cfg }, { data: sec }, { count: docs }, { data: eventos }] = await Promise.all([
    admin
      .from("app_config")
      .select("oferta,tom,agente_ativo,whatsapp_conectado,google_conectado,especialista_numero,onboarding_ok")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("app_tenant_secrets")
      .select("wa_phone_number_id,wa_access_token,evolution_instance")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("app_kb_documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    admin
      .from("app_eventos")
      .select("tipo")
      .eq("tenant_id", tenantId)
      .in("tipo", ["first_response_sent", "appointment_booked"]),
  ]);

  const tiposUso = new Set((eventos ?? []).map((e) => e.tipo as string));
  const waOficial = Boolean(sec?.wa_phone_number_id && sec?.wa_access_token);
  const waConectado = Boolean(cfg?.whatsapp_conectado) || waOficial;

  const itens: ItemProntidao[] = [
    {
      chave: "persona",
      rotulo: "Persona do agente preenchida",
      ok: Boolean((cfg?.oferta ?? "").trim() && (cfg?.tom ?? "").trim()),
      dica: "Preencha ao menos Oferta e Tom de voz no card Persona.",
    },
    {
      chave: "kb",
      rotulo: "Base de conhecimento com documentos",
      ok: (docs ?? 0) > 0,
      dica: "Suba preços, FAQ e políticas no card Base de Conhecimento.",
    },
    {
      chave: "whatsapp",
      rotulo: waOficial ? "WhatsApp conectado (API oficial)" : "WhatsApp conectado",
      ok: waConectado,
      dica: "Conecte por QR (Evolution) ou preencha a Cloud API oficial.",
    },
    {
      chave: "google",
      rotulo: "Agenda Google sincronizada",
      ok: Boolean(cfg?.google_conectado),
      dica: "O cliente conecta em Configurações → Agenda (ou via 'Entrar como').",
    },
    {
      chave: "especialista",
      rotulo: "Número do especialista (handoff) definido",
      ok: Boolean((cfg?.especialista_numero ?? "").trim()),
      dica: "Defina em Configurações → Atendimento para os alertas de handoff.",
    },
    {
      chave: "onboarding",
      rotulo: "Onboarding do cliente concluído",
      ok: Boolean(cfg?.onboarding_ok),
      dica: "O dono percorre o assistente inicial no primeiro acesso.",
    },
    {
      chave: "primeira_resposta",
      rotulo: "IA já respondeu um lead real",
      ok: tiposUso.has("first_response_sent"),
      dica: "Mande uma mensagem de teste no WhatsApp conectado e veja a IA responder.",
    },
    {
      chave: "primeiro_agendamento",
      rotulo: "Primeiro agendamento registrado",
      ok: tiposUso.has("appointment_booked"),
      dica: "Peça um horário no teste ponta a ponta (ou crie um agendamento manual).",
    },
  ];

  return { itens, prontos: itens.filter((i) => i.ok).length, total: itens.length };
}
