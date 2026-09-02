import { redirect } from "next/navigation";
import { Vendas } from "@/components/vendas/Vendas";
import { getVendas } from "@/lib/vendas/data";
import { lerPlaybook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  // Vendas é só do playbook infoproduto. Negócio local que caia aqui pela URL
  // volta pro painel (o item nem aparece no menu dele).
  if ((await lerPlaybook()) !== "infoproduto") redirect("/painel");

  const dados = await getVendas();
  return <Vendas dados={dados} />;
}
