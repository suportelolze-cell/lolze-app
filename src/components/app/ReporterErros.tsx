"use client";

import { useEffect, useRef } from "react";
import { registrarErroCliente } from "@/lib/observability/erro-cliente";

/**
 * Captura erros do lado do cliente que antes só iam para o console (o operador
 * nunca via): exceções não tratadas e promessas rejeitadas. Envia para o registro
 * central (app_erros) com dedupe e um teto por sessão, para não floodar.
 * Montado uma vez no AppShell (área logada, onde há tenant na sessão).
 */
export function ReporterErros() {
  const vistos = useRef<Set<string>>(new Set());
  const enviados = useRef(0);

  useEffect(() => {
    const TETO = 20; // no máximo 20 erros distintos reportados por sessão de página

    function reportar(contexto: string, mensagem: string, detalhe?: string) {
      if (enviados.current >= TETO) return;
      const assinatura = (mensagem + "|" + (detalhe ?? "").slice(0, 120)).slice(0, 220);
      if (vistos.current.has(assinatura)) return;
      vistos.current.add(assinatura);
      enviados.current += 1;
      const rota = typeof location !== "undefined" ? location.pathname : "";
      registrarErroCliente({ contexto, mensagem, detalhe, rota }).catch(() => {});
    }

    function onError(ev: ErrorEvent) {
      const msg = ev.message || "";
      // Ignora ruído sem mensagem (ex.: "Script error." de terceiros cross-origin).
      if (!msg || msg === "Script error.") return;
      const stack = ev.error instanceof Error ? ev.error.stack : undefined;
      reportar("cliente.window", msg, stack || `${ev.filename}:${ev.lineno}:${ev.colno}`);
    }

    function onRejection(ev: PromiseRejectionEvent) {
      const r = ev.reason;
      const msg = r instanceof Error ? r.message : String(r);
      if (!msg) return;
      reportar("cliente.promise", msg, r instanceof Error ? r.stack : undefined);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
