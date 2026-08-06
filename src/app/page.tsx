import { Landing } from "@/components/landing/Landing";
import { getPlanosPublicos } from "@/lib/cadastro/data";

// Landing pública e estável: ISR (estática + revalidação) no lugar de SSR por
// request. Servida de cache/CDN e regenerada a cada 5 min — os planos/preços
// aparecem em até 5 min após uma edição, sem consultar o banco a cada visita.
export const revalidate = 300;

export default async function Home() {
  const planos = await getPlanosPublicos();
  return <Landing planos={planos} />;
}
