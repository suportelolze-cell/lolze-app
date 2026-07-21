"use server";

import { getCrmAdmin } from "@/lib/supabase/admin";
import { enviarTexto, temEvolutionConfig } from "@/lib/evolution/client";
import { ipDoCliente, dentroDoLimite, honeypot } from "@/lib/seguranca/antiabuso";
import { registrarFunilLolze } from "@/lib/funil-lolze";

// Tenant da própria Lolze (onde caem os leads da landing). Override por env.
const LOLZE_TENANT = process.env.LOLZE_TENANT_ID || "6196a5bb-40ea-4166-ac8e-76855c51696e";

/**
 * Captura uma aplicação da landing (quiz "Aplicar Agora") como LEAD no CRM da
 * Lolze — para o lead NÃO se perder se a pessoa não abrir o WhatsApp.
 * Público (sem sessão): usa service-role. Best-effort: nunca lança.
 */
export async function registrarAplicacao(input: {
  nome: string;
  telefone: string;
  negocio: string;
  faturamento: string;
  trafego: string;
  dificuldade: string;
  hp?: string;
}): Promise<{ ok: boolean }> {
  // Anti-abuso: bot (isca) ou excesso → sai quieto (best-effort, não cria lixo).
  if (honeypot(input.hp)) return { ok: true };
  if (!(await dentroDoLimite("aplicacao", await ipDoCliente(), 4, 900))) return { ok: true };

  let admin;
  try {
    admin = getCrmAdmin();
  } catch {
    return { ok: false };
  }

  const telefone = (input.telefone || "").replace(/\D/g, "");
  const nome = (input.nome || "").trim() || "Aplicação (landing)";
  const diagnostico =
    `Aplicação pela landing. Nicho: ${input.negocio || "—"} · ` +
    `Faturamento: ${input.faturamento || "—"} · Tráfego: ${input.trafego || "—"} · ` +
    `Dificuldade: ${input.dificuldade || "—"}`;

  // 1) Grava/atualiza como lead quente na entrada do funil da Lolze.
  try {
    let existenteId: number | null = null;
    if (telefone) {
      const { data } = await admin
        .from("app_leads")
        .select("id")
        .eq("tenant_id", LOLZE_TENANT)
        .eq("canal", "aplicacao")
        .eq("telefone", telefone)
        .limit(1)
        .maybeSingle();
      existenteId = (data?.id as number | null) ?? null;
    }
    if (existenteId) {
      await admin
        .from("app_leads")
        .update({ nome, diagnostico, temperatura: "quente", updated_at: new Date().toISOString() })
        .eq("id", existenteId);
    } else {
      await admin.from("app_leads").insert({
        tenant_id: LOLZE_TENANT,
        nome,
        telefone: telefone || null,
        origem: "landing",
        canal: "aplicacao",
        temperatura: "quente",
        coluna: "entrada",
        diagnostico,
        ultima_msg: `Aplicou pela landing (${input.negocio || "—"})`,
      });
    }
  } catch {
    // best-effort
  }

  // Funil da Lolze: aplicação enviada.
  await registrarFunilLolze("aplicacao_enviada", { negocio: input.negocio || null });

  // 2) Avisa a operação no WhatsApp (best-effort).
  try {
    const ops = (process.env.LOLZE_OPS_WHATSAPP || "").trim();
    if (ops && temEvolutionConfig()) {
      const { data: sec } = await admin
        .from("app_tenant_secrets")
        .select("evolution_instance")
        .eq("tenant_id", LOLZE_TENANT)
        .maybeSingle();
      const inst = ((sec?.evolution_instance as string | null) ?? "").trim();
      if (inst) {
        const msg = [
          "🎯 *Nova aplicação (landing)*",
          `Nome: ${nome}`,
          `WhatsApp: ${telefone || "—"}`,
          `Negócio: ${input.negocio || "—"}`,
          `Faturamento: ${input.faturamento || "—"}`,
          `Tráfego pago: ${input.trafego || "—"}`,
          `Dificuldade: ${input.dificuldade || "—"}`,
        ].join("\n");
        await enviarTexto(inst, ops, msg).catch(() => null);
      }
    }
  } catch {
    // best-effort
  }

  return { ok: true };
}
