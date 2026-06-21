import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlanos } from "@/lib/admin/data";
import { temServiceKey } from "@/lib/supabase/admin";
import { NovoClienteForm } from "@/components/admin/NovoClienteForm";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const planos = await getPlanos();
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
      >
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>
      <header className="mb-8">
        <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
          Cadastrar <span className="text-marca">cliente</span>
        </h1>
        <p className="mt-1 text-texto-suave">
          Cria a empresa, o acesso do dono e a configuração inicial.
        </p>
      </header>
      <NovoClienteForm
        planos={planos.map((p) => ({ id: p.id, nome: p.nome, canaisMax: p.canaisMax }))}
        semKey={!temServiceKey()}
      />
    </div>
  );
}
