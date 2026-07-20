import { CadastroForm } from "@/components/cadastro/CadastroForm";
import { getPlanosPublicos } from "@/lib/cadastro/data";

export const dynamic = "force-dynamic";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const planos = await getPlanosPublicos();
  const sp = await searchParams;
  const planoInicial = sp?.plano ?? planos[0]?.id ?? "";
  return <CadastroForm planos={planos} planoInicial={planoInicial} />;
}
