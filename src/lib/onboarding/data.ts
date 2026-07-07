import { getCrmAdmin } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/supabase/tenant";

export type OnboardingData = {
  nomeNegocio: string;
  endereco: string;
  horario: string;
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
  whatsappConectado: boolean;
  feito: boolean;
};

const VAZIO: OnboardingData = {
  nomeNegocio: "",
  endereco: "",
  horario: "",
  oferta: "",
  publico: "",
  tom: "",
  objecoes: "",
  faq: "",
  regras: "",
  whatsappConectado: false,
  feito: false,
};

export async function getOnboarding(): Promise<OnboardingData> {
  const tid = await getTenantId();
  if (!tid) return VAZIO;
  const sb = getCrmAdmin();
  const { data } = await sb
    .from("app_config")
    .select(
      "nome_negocio,endereco,horario,oferta,publico,tom,objecoes,faq,regras,whatsapp_conectado,onboarding_ok"
    )
    .eq("tenant_id", tid)
    .maybeSingle();
  const s = (k: string) => (typeof (data as Record<string, unknown>)?.[k] === "string" ? ((data as Record<string, unknown>)[k] as string) : "");
  return {
    nomeNegocio: s("nome_negocio"),
    endereco: s("endereco"),
    horario: s("horario"),
    oferta: s("oferta"),
    publico: s("publico"),
    tom: s("tom"),
    objecoes: s("objecoes"),
    faq: s("faq"),
    regras: s("regras"),
    whatsappConectado: Boolean(data?.whatsapp_conectado),
    feito: Boolean(data?.onboarding_ok),
  };
}
