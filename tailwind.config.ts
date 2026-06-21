import type { Config } from "tailwindcss";

/**
 * LOLZE · Design System — fonte de verdade do Tailwind.
 * Cores e fontes vêm da identidade da marca (ver ../Marca/Identidade Visual.md).
 * As fontes são injetadas como CSS vars por next/font em src/app/layout.tsx.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta crua da marca
        "verde-floresta": "#15803D",
        "bege-principal": "#FAFAF7",
        "cinza-200": "#E2DED2",
        "cinza-600": "#5A554C",
        "escuro-quente": "#161412",
        "verde-suave": "#DCFCE7",
        // Tokens semânticos (prefira estes)
        fundo: "#FAFAF7",
        superficie: "#FFFFFF",
        "superficie-2": "#E2DED2",
        borda: "#E2DED2",
        texto: "#161412",
        "texto-suave": "#5A554C",
        marca: "#15803D",
        "marca-suave": "#DCFCE7",
      },
      fontFamily: {
        // Variáveis definidas via next/font/local no layout
        display: ["var(--font-display)", "Georgia", "serif"], // Fraunces itálica
        sans: ["var(--font-corpo)", "system-ui", "sans-serif"], // Geist (default)
        corpo: ["var(--font-corpo)", "system-ui", "sans-serif"],
        marca: ["var(--font-marca)", "var(--font-corpo)", "sans-serif"], // Quicksand
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "24px",
      },
    },
  },
  plugins: [],
};

export default config;
