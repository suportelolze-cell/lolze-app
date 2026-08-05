import { cn } from "./cn";

/**
 * Botão do design system (identidade da landing).
 * - primary: pill ESCURO (preto esverdeado), hover verde + leve subida. É a ação principal.
 * - verde:   pill VERDE (ações "positivas" quando o verde deve liderar).
 * - secondary: claro com borda fina.
 * - ghost:   sem preenchimento (ações discretas).
 * - danger:  destrutivo.
 *
 * Use <Button> para <button>; use buttonClasses() para aplicar o mesmo estilo em
 * <Link> ou submit de <form> (sem forçar tudo a virar <button>).
 */
export type ButtonVariant = "primary" | "verde" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-all " +
  "disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2";

const variantes: Record<ButtonVariant, string> = {
  primary:
    "bg-escuro-quente text-bege-principal shadow-[0_10px_24px_rgba(18,30,22,.14)] hover:bg-marca-escura hover:-translate-y-0.5",
  verde: "bg-marca text-bege-principal hover:bg-marca-escura hover:-translate-y-0.5",
  secondary: "border border-borda bg-superficie text-texto hover:border-marca hover:text-marca",
  ghost: "text-texto hover:bg-fundo-2",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const tamanhos: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(base, variantes[variant], tamanhos[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
