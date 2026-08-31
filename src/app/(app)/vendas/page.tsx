import { Vendas } from "@/components/vendas/Vendas";
import { getVendas } from "@/lib/vendas/data";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const dados = await getVendas();
  return <Vendas dados={dados} />;
}
