import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Eye, KanbanSquare, Users } from "lucide-react";
import { getCliente, getPlanos, getWebhooks, getIngestToken, getPersona } from "@/lib/admin/data";
import { entrarComo } from "@/lib/admin/actions";
import { GerenciarClienteForm } from "@/components/admin/GerenciarClienteForm";
import { PersonaForm } from "@/components/admin/PersonaForm";
import { WebhooksForm } from "@/components/admin/WebhooksForm";
import { IngestForm } from "@/components/admin/IngestForm";
import { KbForm } from "@/components/admin/KbForm";
import { listarDocs } from "@/lib/kb/data";
import { temOpenAIKey } from "@/lib/kb/embed";

export const dynamic = "force-dynamic";

export default async function ClientePage({ params }: { params: { id: string } }) {
  const [cliente, planos, webhooks, ingestToken, docs, persona] = await Promise.all([
    getCliente(params.id),
    getPlanos(),
    getWebhooks(params.id),
    getIngestToken(params.id),
    listarDocs(params.id),
    getPersona(params.id),
  ]);
  if (!cliente) notFound();
  const semOpenAI = !temOpenAIKey();

  const h = headers();
  const host = h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/ingest`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
      >
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            {cliente.nome}
          </h1>
          <p className="mt-1 text-texto-suave">{cliente.contatoEmail}</p>
        </div>
        <form action={entrarComo.bind(null, cliente.id)}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-sm bg-escuro-quente px-4 py-2.5 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
          >
            <Eye size={16} /> Entrar como este cliente
          </button>
        </form>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-borda bg-superficie px-5 py-4">
          <KanbanSquare size={18} className="text-marca" />
          <p className="mt-2 text-2xl font-semibold text-texto">{cliente.leads}</p>
          <p className="text-xs text-texto-suave">Leads no pipeline</p>
        </div>
        <div className="rounded-lg border border-borda bg-superficie px-5 py-4">
          <Users size={18} className="text-marca" />
          <p className="mt-2 text-2xl font-semibold text-texto">{cliente.usuarios}</p>
          <p className="text-xs text-texto-suave">Usuários da conta</p>
        </div>
      </section>

      <GerenciarClienteForm
        cliente={cliente}
        planos={planos.map((p) => ({ id: p.id, nome: p.nome, canaisMax: p.canaisMax }))}
      />

      <div className="mt-6">
        <PersonaForm tenantId={cliente.id} persona={persona} />
      </div>

      <div className="mt-6">
        <WebhooksForm tenantId={cliente.id} urlsIniciais={webhooks} />
      </div>

      <div className="mt-6">
        <IngestForm tenantId={cliente.id} endpoint={endpoint} tokenInicial={ingestToken} />
      </div>

      <div className="mt-6">
        <KbForm tenantId={cliente.id} docs={docs} semKey={semOpenAI} />
      </div>
    </div>
  );
}
