import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

/**
 * Estado vazio consistente (mesma identidade em todo o app): ícone em círculo
 * menta, título, descrição e ação opcional. Centralizado.
 */
export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: LucideIcon;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-marca-suave text-marca">
          <Icon size={24} strokeWidth={2} />
        </div>
      )}
      <p className="font-corpo text-base font-semibold text-texto">{titulo}</p>
      {descricao && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-texto-suave">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
