import { cn } from "./cn";

/**
 * Badge/status pill (identidade da landing). Padrão em verde menta; variantes
 * para estados neutros, atenção e erro. Use para rótulos curtos e status.
 */
export type BadgeTom = "menta" | "neutro" | "atencao" | "erro" | "escuro";

const tons: Record<BadgeTom, string> = {
  menta: "bg-marca-suave text-marca",
  neutro: "bg-fundo-2 text-texto-suave",
  atencao: "bg-amber-100 text-amber-700",
  erro: "bg-red-100 text-red-600",
  escuro: "bg-escuro-quente text-bege-principal",
};

export function Badge({
  tom = "menta",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tom?: BadgeTom }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold",
        tons[tom],
        className
      )}
      {...props}
    />
  );
}

/** Bolinha de status (verde ligado / cinza desligado / âmbar atenção). */
export function StatusDot({ tom = "menta", className }: { tom?: "menta" | "neutro" | "atencao" | "erro"; className?: string }) {
  const cor =
    tom === "menta" ? "bg-marca" : tom === "atencao" ? "bg-amber-500" : tom === "erro" ? "bg-red-500" : "bg-texto-suave/40";
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", cor, className)} />;
}
