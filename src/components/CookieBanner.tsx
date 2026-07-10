"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CHAVE = "lolze_cookie_consent";

export function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE)) setVisivel(true);
    } catch {
      // localStorage indisponível — não mostra
    }
  }, []);

  function decidir(valor: "aceito" | "recusado") {
    try {
      localStorage.setItem(
        CHAVE,
        JSON.stringify({ valor, em: new Date().toISOString() })
      );
    } catch {}
    setVisivel(false);
    // Ativa os scripts de marketing (Meta Pixel) SÓ com o aceite (LGPD).
    if (valor === "aceito") {
      try {
        window.dispatchEvent(new Event("cookies-aceito"));
      } catch {}
    }
  }

  if (!visivel) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-white/10 bg-escuro-quente p-5 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-bege-principal/80">
          Usamos cookies essenciais para o site funcionar e, com seu
          consentimento, cookies de desempenho e marketing. Veja a{" "}
          <Link href="/cookies" className="text-verde-suave underline">
            Política de Cookies
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decidir("recusado")}
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-bege-principal/80 hover:text-bege-principal"
          >
            Recusar
          </button>
          <button
            onClick={() => decidir("aceito")}
            className="rounded-md bg-marca px-4 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
