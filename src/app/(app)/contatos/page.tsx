import { Contatos } from "@/components/contatos/Contatos";
import { getContatos } from "@/lib/contatos/data";
import { lerPlaybook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const [contatos, playbook] = await Promise.all([getContatos(), lerPlaybook()]);
  const canais = Array.from(new Set(contatos.map((c) => c.canal).filter(Boolean)));
  return <Contatos contatos={contatos} canais={canais} playbook={playbook} />;
}
