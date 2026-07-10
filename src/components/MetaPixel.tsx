"use client";

import { useEffect } from "react";

// Pixel da Meta — ID público. Só carrega APÓS o aceite de cookies (LGPD).
const PIXEL_ID = "1012978488146076";
const CHAVE = "lolze_cookie_consent";

function consentiu(): boolean {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? JSON.parse(raw)?.valor === "aceito" : false;
  } catch {
    return false;
  }
}

function carregarPixel() {
  const w = window as unknown as { _lolzePixel?: boolean };
  if (w._lolzePixel) return; // idempotente
  w._lolzePixel = true;
  const s = document.createElement("script");
  s.innerHTML =
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`;
  document.head.appendChild(s);
}

export function MetaPixel() {
  useEffect(() => {
    // Já consentiu numa visita anterior → carrega agora.
    if (consentiu()) carregarPixel();
    // Aceitou agora no banner → carrega.
    const onAceite = () => carregarPixel();
    window.addEventListener("cookies-aceito", onAceite);
    return () => window.removeEventListener("cookies-aceito", onAceite);
  }, []);
  return null;
}
