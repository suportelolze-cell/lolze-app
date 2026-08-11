"use client";

import { useEffect, useRef } from "react";

/**
 * Widget do Cloudflare Turnstile (CAPTCHA sem atrito) para as telas de auth.
 *
 * DESLIGADO por padrão: só renderiza se NEXT_PUBLIC_TURNSTILE_SITEKEY estiver
 * definido. Sem a env, o componente não aparece e o login/recuperação seguem
 * como hoje. Para ativar: criar o widget no Cloudflare, colocar o sitekey em
 * NEXT_PUBLIC_TURNSTILE_SITEKEY (Vercel) e ligar o CAPTCHA no Supabase (Auth >
 * Attack Protection) com o secret.
 *
 * O token gerado é de uso único: chame `resetTurnstile()` depois de cada
 * tentativa para pegar um novo antes de reenviar.
 */
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

/** Turnstile está configurado neste ambiente? */
export const TURNSTILE_ATIVO = Boolean(SITEKEY);

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let widgetAtual: string | null = null;

/** Reseta o widget para gerar um novo token (token é de uso único). */
export function resetTurnstile() {
  if (widgetAtual && window.turnstile) window.turnstile.reset(widgetAtual);
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITEKEY) return;
    let vivo = true;

    function renderizar() {
      if (!vivo || !ref.current || !window.turnstile || widgetAtual) return;
      widgetAtual = window.turnstile.render(ref.current, {
        sitekey: SITEKEY!,
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderizar();
      return () => {
        vivo = false;
      };
    }

    // Carrega o script uma vez e renderiza quando ficar disponível.
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const iv = setInterval(() => {
      if (window.turnstile) {
        clearInterval(iv);
        renderizar();
      }
    }, 200);

    return () => {
      vivo = false;
      clearInterval(iv);
      if (widgetAtual && window.turnstile) {
        window.turnstile.remove(widgetAtual);
        widgetAtual = null;
      }
    };
  }, [onToken]);

  if (!SITEKEY) return null;
  return <div ref={ref} className="mt-1 flex justify-center" />;
}
