import { Landing } from "@/components/landing/Landing";
import { getPlanosPublicos } from "@/lib/cadastro/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const planos = await getPlanosPublicos();
  return <Landing planos={planos} />;
}
