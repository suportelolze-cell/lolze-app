import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { Badge } from "./Badge";

/**
 * Cartão de métrica (Dashboard): rótulo, valor grande, micro-explicação e ícone.
 * Identidade da landing — superfície branca, borda fina, sombra discreta. O
 * `destaque` realça a métrica principal com um fio verde à esquerda.
 */
export function MetricCard({
  titulo,
  valor,
  microcopy,
  icon: Icon,
  selo,
  destaque = false,
  className,
}: {
  titulo: string;
  valor: React.ReactNode;
  microcopy?: React.ReactNode;
  icon?: LucideIcon;
  selo?: string;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-borda bg-superficie p-5 shadow-card",
        destaque && "border-l-[3px] border-l-marca",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">{titulo}</span>
        {Icon && <Icon size={16} className="shrink-0 text-marca" />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold -tracking-[0.02em] text-texto">{valor}</span>
        {selo && <Badge className="mb-1">{selo}</Badge>}
      </div>
      {microcopy && <p className="mt-1.5 text-xs leading-relaxed text-texto-suave">{microcopy}</p>}
    </div>
  );
}
