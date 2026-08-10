import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";

/**
 * Moldura visual comum das telas de autenticação (login, recuperar, nova senha).
 * Mesma identidade do login: fundo com brilho verde, logo, cartão branco.
 */
const BG =
  "radial-gradient(circle at 50% 22%, rgba(46,167,97,.12), transparent 32%), var(--fundo)";

/** Classe padrão dos inputs das telas de auth. */
export const authInputCls =
  "w-full rounded-md border border-borda bg-fundo px-3.5 py-2.5 text-sm text-texto outline-none transition-colors focus:border-marca";

export function AuthShell({
  titulo,
  subtitulo,
  children,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: BG }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variante="lockup" tom="escuro" height={40} />
        </div>
        <Card className="p-8">
          <h1 className="font-corpo text-2xl font-semibold -tracking-[0.02em] text-texto">
            {titulo}
          </h1>
          {subtitulo && (
            <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">{subtitulo}</p>
          )}
          {children}
        </Card>
      </div>
    </main>
  );
}
