import { Captacao } from "@/components/captacao/Captacao";
import { getCaptacaoCfg, getProspectsResumo, listarProspects } from "@/lib/captacao/data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

export default async function CaptacaoPage() {
  const sessao = await getSessao();
  const gestor = sessao.papel === "owner" || sessao.papel === "superadmin";
  if (!gestor) {
    return (
      <div className="rounded-lg border border-borda bg-superficie p-8 text-center text-texto-suave">
        A Captação é restrita ao gestor da conta.
      </div>
    );
  }

  const [cfg, resumo, prospects] = await Promise.all([
    getCaptacaoCfg(),
    getProspectsResumo(),
    listarProspects(),
  ]);

  return <Captacao cfgInicial={cfg} resumo={resumo} prospects={prospects} />;
}
