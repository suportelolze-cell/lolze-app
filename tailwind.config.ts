import type { Config } from "tailwindcss";

/**
 * LOLZE · Design System — fonte de verdade do Tailwind.
 * Paleta e tipografia derivadas da LANDING (design-reference/lolze-ia-landing):
 * paper/ink/green/mint/black, com verde esmeralda de ação e preto esverdeado nas
 * áreas de contraste. Trocar os VALORES aqui cascateia a identidade para todo o
 * app (os componentes usam os tokens semânticos abaixo). As fontes são injetadas
 * como CSS vars por next/font em src/app/layout.tsx (Geist na interface; Fraunces
 * itálica só em destaques editoriais).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta crua da landing
        "verde-floresta": "#16834f", // --green (ação/destaque)
        "verde-escuro": "#0e6d3f", // --green-2 (hover dos botões/ações)
        "bege-principal": "#f8f7f2", // --paper (fundo principal off-white)
        "bege-2": "#f0eee5", // --paper-2 (fundo secundário)
        "cinza-200": "#dfe3dc", // --line (bordas finas)
        "cinza-600": "#5f6c63", // --muted (texto secundário)
        "escuro-quente": "#111713", // --black (áreas de contraste: sidebar, botões escuros)
        tinta: "#13221a", // --ink (texto principal)
        "verde-suave": "#dff6e8", // --mint (badges/status)
        // Tokens semânticos (prefira estes nos componentes)
        fundo: "#f8f7f2",
        "fundo-2": "#f0eee5",
        superficie: "#ffffff",
        "superficie-2": "#f0eee5",
        borda: "#dfe3dc",
        texto: "#13221a",
        "texto-suave": "#5f6c63",
        marca: "#16834f",
        "marca-escura": "#0e6d3f",
        "marca-suave": "#dff6e8",
      },
      fontFamily: {
        // Variáveis definidas via next/font/local no layout
        display: ["var(--font-display)", "Georgia", "serif"], // Fraunces itálica — SÓ editorial
        sans: ["var(--font-corpo)", "system-ui", "sans-serif"], // Geist (default da interface)
        corpo: ["var(--font-corpo)", "system-ui", "sans-serif"],
        marca: ["var(--font-marca)", "var(--font-corpo)", "sans-serif"], // Quicksand (wordmark)
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "18px", // cartões (landing usa 17–22px)
        xl: "22px",
        pill: "9999px", // botões e badges (landing)
      },
      boxShadow: {
        // Sombras discretas da landing (nada de neon/glassmorphism exagerado)
        card: "0 1px 2px rgba(19,34,26,.04), 0 8px 24px rgba(25,42,31,.05)",
        "card-hover": "0 12px 32px rgba(25,42,31,.09)",
        pop: "0 20px 50px rgba(30,43,34,.12)",
      },
      maxWidth: {
        conteudo: "1100px", // largura editorial padrão da landing
      },
    },
  },
  plugins: [],
};

export default config;
