import Image from "next/image";

/**
 * Logo da Lolze. Respeita a regra de contraste da marca:
 * - símbolo/lockup ESCURO sobre fundos claros (creme, verde suave)
 * - símbolo/lockup BRANCO sobre fundos escuros (escuro quente, verde floresta)
 * Ver ../../Marca/Identidade Visual.md
 */
type Variante = "simbolo" | "wordmark" | "lockup";
type Tom = "escuro" | "branco";

const arquivos: Record<Variante, Record<Tom, string>> = {
  simbolo: { escuro: "/logo/simbolo.svg", branco: "/logo/simbolo-branco.svg" },
  wordmark: { escuro: "/logo/wordmark.svg", branco: "/logo/wordmark-branco.svg" },
  lockup: { escuro: "/logo/lockup.svg", branco: "/logo/lockup-branco.svg" },
};

const proporcao: Record<Variante, number> = {
  simbolo: 1, // 300x300
  wordmark: 5, // 375x75
  lockup: 5, // 375x75
};

export function Logo({
  variante = "lockup",
  tom = "escuro",
  height = 40,
  className,
}: {
  variante?: Variante;
  tom?: Tom;
  height?: number;
  className?: string;
}) {
  const src = arquivos[variante][tom];
  const width = Math.round(height * proporcao[variante]);
  return (
    <Image
      src={src}
      alt="Lolze"
      width={width}
      height={height}
      className={className}
      priority
      unoptimized
    />
  );
}
