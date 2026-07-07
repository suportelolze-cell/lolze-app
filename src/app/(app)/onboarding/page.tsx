import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getOnboarding } from "@/lib/onboarding/data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const sessao = await getSessao();
  const gestor = sessao.papel === "owner" || sessao.papel === "superadmin";
  if (!gestor) {
    return (
      <div className="rounded-lg border border-borda bg-superficie p-8 text-center text-texto-suave">
        A configuração inicial é feita pelo dono da conta.
      </div>
    );
  }
  const dados = await getOnboarding();
  return <OnboardingWizard dados={dados} />;
}
