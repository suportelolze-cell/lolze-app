import { CadastroForm } from "@/components/cadastro/CadastroForm";
import { getPlanosPublicos } from "@/lib/cadastro/data";

export const dynamic = "force-dynamic";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: { plano?: string };
}) {
  const planos = await getPlanosPublicos();
  const planoInicial = searchParams?.plano ?? planos[0]?.id ?? "";
  return <CadastroForm planos={planos} planoInicial={planoInicial} />;
}
