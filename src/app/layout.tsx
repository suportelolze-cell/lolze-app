import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { MetaPixel } from "@/components/MetaPixel";

/* ----- Fontes locais (self-hosted, sem Google Fonts CDN) ----------------- */
// Geist — corpo de texto e interface (default)
const geist = localFont({
  src: "./fonts/geist.woff2",
  variable: "--font-corpo",
  weight: "100 900",
  display: "swap",
});

// Quicksand — wordmark da marca
const quicksand = localFont({
  src: "./fonts/quicksand.woff2",
  variable: "--font-marca",
  weight: "300 700",
  display: "swap",
});

// Fraunces (itálica) — destaques e acentos editoriais
const fraunces = localFont({
  src: "./fonts/fraunces-italic.woff2",
  variable: "--font-display",
  weight: "100 900",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lolze · Sistema de Escala",
  description:
    "Nós construímos a máquina. Sua equipe aperta o botão. Você fica com o lucro.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${quicksand.variable} ${fraunces.variable}`}
    >
      <body>
        {children}
        <CookieBanner />
        <MetaPixel />
      </body>
    </html>
  );
}
