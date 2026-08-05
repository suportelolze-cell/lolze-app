import { cn } from "./cn";

/**
 * Cartão do design system: superfície branca, borda fina, cantos arredondados e
 * sombra discreta (identidade da landing). `hover` adiciona uma elevação sutil.
 */
export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-borda bg-superficie shadow-card",
        hover && "transition-shadow hover:shadow-card-hover",
        className
      )}
      {...props}
    />
  );
}

/** Cabeçalho interno de um cartão (título + ação opcional à direita). */
export function CardHeader({
  titulo,
  acao,
  className,
}: {
  titulo: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-borda px-5 py-4", className)}>
      <h2 className="font-corpo text-sm font-bold text-texto">{titulo}</h2>
      {acao}
    </div>
  );
}
