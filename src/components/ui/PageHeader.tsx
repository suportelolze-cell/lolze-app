import { cn } from "./cn";

/**
 * Acento editorial: trecho em serif itálica verde (Fraunces), como o `em` verde
 * da landing. Use com moderação, só em destaques — NUNCA em texto operacional.
 * Ex.: <PageHeader titulo={<>Visão <Acento>geral</Acento></>} />
 */
export function Acento({ children }: { children: React.ReactNode }) {
  return <em className="font-display not-italic text-marca">{children}</em>;
}

/**
 * Cabeçalho de página: título (Geist, tracking apertado, como a landing) +
 * contexto opcional + ação principal à direita. Responsivo (empilha no mobile).
 */
export function PageHeader({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-corpo text-2xl font-semibold -tracking-[0.02em] text-texto sm:text-[28px]">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-texto-suave">{descricao}</p>}
      </div>
      {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
    </header>
  );
}
