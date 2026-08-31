"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { registrarErroCliente } from "@/lib/observability/erro-cliente";

/**
 * Boundary de erro do segmento logado. Em vez da tela em branco / erro cru do
 * Next, mostra uma recuperação amigável e REPORTA o erro (app_erros) para o
 * operador ver. `reset` re-renderiza o segmento sem recarregar a página toda.
 */
export default function ErroApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    registrarErroCliente({
      contexto: "cliente.render",
      mensagem: error.message || "erro de renderização",
      detalhe: [error.digest ? `digest: ${error.digest}` : "", error.stack ?? ""]
        .filter(Boolean)
        .join("\n"),
      severidade: "media",
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-suave">
        <AlertTriangle size={26} className="text-marca-escura" />
      </div>
      <h1 className="mt-5 font-corpo text-xl font-bold text-texto">Algo travou nesta tela</h1>
      <p className="mt-2 max-w-md text-sm text-texto-suave">
        Já registramos o que aconteceu para a equipe olhar. Você pode tentar de novo
        agora mesmo. Se persistir, atualize a página ou fale com o suporte.
      </p>
      <div className="mt-6">
        <Button variant="primary" onClick={reset}>
          <RotateCcw size={16} /> Tentar de novo
        </Button>
      </div>
    </div>
  );
}
