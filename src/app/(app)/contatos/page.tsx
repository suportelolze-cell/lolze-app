import { Contatos } from "@/components/contatos/Contatos";
import { getContatos } from "@/lib/contatos/data";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const contatos = await getContatos();
  const canais = Array.from(new Set(contatos.map((c) => c.canal).filter(Boolean)));
  return <Contatos contatos={contatos} canais={canais} />;
}
