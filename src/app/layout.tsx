import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";

// Meta Pixel (rastreamento de anúncios). ID público — pode ficar no código.
const META_PIXEL_ID = "1012978488146076";

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
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            alt=""
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
      </body>
    </html>
  );
}
