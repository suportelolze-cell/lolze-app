"use client";

/** Botão que abre o quiz de qualificação (em vez de ir direto pro WhatsApp). */
export function AplicarButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("abrir-aplicacao"))}
      className={className}
    >
      {children}
    </button>
  );
}
