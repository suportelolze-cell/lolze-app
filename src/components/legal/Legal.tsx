import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LegalPage({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  atualizado: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bege-principal">
      {/* Topo */}
      <header className="border-b border-borda bg-escuro-quente">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo variante="lockup" tom="branco" height={24} />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-bege-principal/70 hover:text-bege-principal"
          >
            <ArrowLeft size={15} /> Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {/* Aviso de rascunho — REMOVER antes de publicar */}
        <div className="mb-8 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <Scale size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-800">
            <strong>Rascunho jurídico.</strong> Modelo base conforme a legislação
            brasileira (LGPD, Marco Civil da Internet, CDC). Preencha os campos
            entre <code>[colchetes]</code> e submeta a revisão de um(a) advogado(a)
            antes de publicar. Remova este aviso na versão final.
          </p>
        </div>

        <h1 className="font-display text-3xl font-medium italic text-texto sm:text-4xl">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-texto-suave">Última atualização: {atualizado}</p>

        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-borda bg-escuro-quente px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <Logo variante="lockup" tom="branco" height={20} />
          <div className="flex gap-5 text-xs text-bege-principal/50">
            <Link href="/privacidade" className="hover:text-bege-principal">Privacidade</Link>
            <Link href="/cookies" className="hover:text-bege-principal">Cookies</Link>
            <Link href="/termos" className="hover:text-bege-principal">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 font-display text-xl font-medium italic text-texto">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-sm leading-relaxed text-texto-suave">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-texto-suave">
      {children}
    </ul>
  );
}
