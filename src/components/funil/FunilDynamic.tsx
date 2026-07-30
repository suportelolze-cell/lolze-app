"use client";

import dynamic from "next/dynamic";
import type { DadosFunil, Periodo } from "@/lib/funil";

/**
 * Carrega o Funil (usa @xyflow/react — a lib de cliente mais pesada do projeto,
 * só nesta rota) apenas no cliente. Evita SSR/hidratação de um canvas que é
 * descartado, e o wrapper 'use client' permite ssr:false (proibido direto no
 * Server Component).
 */
const Funil = dynamic(() => import("./Funil").then((m) => m.Funil), {
  ssr: false,
  loading: () => (
    <div className="h-[calc(100vh-7rem)] animate-pulse rounded-lg border border-borda bg-fundo" />
  ),
});

export function FunilDynamic({ dados }: { dados: Record<Periodo, DadosFunil> }) {
  return <Funil dados={dados} />;
}
