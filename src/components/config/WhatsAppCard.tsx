"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, QrCode } from "lucide-react";
import {
  acaoConectarWhatsapp,
  acaoStatusWhatsapp,
  acaoDesconectarWhatsapp,
} from "@/lib/integracoes/whatsapp-actions";

type Estado = "carregando" | "desconectado" | "qr" | "conectado" | "indisponivel";

function Badge({ on, texto }: { on: boolean; texto: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        on ? "bg-marca-suave text-marca" : "bg-red-100 text-red-600"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-marca" : "bg-red-500"}`} />
      {texto}
    </span>
  );
}

export function WhatsAppCard() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [qr, setQr] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pararPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Status inicial
  useEffect(() => {
    (async () => {
      const r = await acaoStatusWhatsapp();
      if (!r.ok && r.erro?.includes("não configurada")) {
        setEstado("indisponivel");
        return;
      }
      if (r.conectado) {
        setNumero(r.numero ?? null);
        setEstado("conectado");
      } else {
        setEstado("desconectado");
      }
    })();
    return pararPoll;
  }, []);

  // Quando conectado, re-checa a cada 20s pra detectar queda de sessão.
  useEffect(() => {
    if (estado !== "conectado") return;
    const id = setInterval(async () => {
      const r = await acaoStatusWhatsapp();
      if (r.ok && !r.conectado) setEstado("desconectado");
      else if (r.conectado) setNumero(r.numero ?? null);
    }, 20000);
    return () => clearInterval(id);
  }, [estado]);

  // Enquanto exibe QR, fica perguntando se já conectou
  function iniciarPoll() {
    pararPoll();
    pollRef.current = setInterval(async () => {
      const r = await acaoStatusWhatsapp();
      if (r.conectado) {
        pararPoll();
        setQr(null);
        setNumero(r.numero ?? null);
        setEstado("conectado");
      }
    }, 3000);
  }

  async function conectar() {
    setOcupado(true);
    setErro("");
    try {
      const r = await acaoConectarWhatsapp();
      if (!r.ok) {
        setErro(r.erro || "Falha ao conectar.");
        return;
      }
      if (r.conectado) {
        setNumero(r.numero ?? null);
        setEstado("conectado");
        return;
      }
      if (r.qr) {
        setQr(r.qr);
        setEstado("qr");
        iniciarPoll();
      } else {
        setErro("Não veio o QR. Tente de novo.");
      }
    } finally {
      setOcupado(false);
    }
  }

  async function desconectar() {
    setOcupado(true);
    setErro("");
    try {
      await acaoDesconectarWhatsapp();
      pararPoll();
      setQr(null);
      setNumero(null);
      setEstado("desconectado");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 text-sm text-texto-suave">
        <Loader2 size={16} className="animate-spin" /> Verificando conexão…
      </div>
    );
  }

  if (estado === "indisponivel") {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Conexão de WhatsApp ainda não habilitada nesta conta. Fale com o suporte.
      </div>
    );
  }

  if (estado === "conectado") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge on texto="Conectado e Operante" />
          {numero && <p className="mt-1.5 text-sm text-texto">+{numero}</p>}
        </div>
        <button
          onClick={desconectar}
          disabled={ocupado}
          className="rounded-md border border-borda px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {ocupado ? "…" : "Desconectar"}
        </button>
      </div>
    );
  }

  if (estado === "qr") {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="QR Code do WhatsApp"
            className="h-44 w-44 rounded-lg border border-borda bg-white p-2"
          />
        )}
        <div className="flex-1 text-sm text-texto-suave">
          <p className="font-semibold text-texto">Escaneie para conectar</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs">
            <li>Abra o WhatsApp no celular</li>
            <li>Toque em <b>Aparelhos conectados</b></li>
            <li>Toque em <b>Conectar um aparelho</b></li>
            <li>Aponte a câmera para este QR</li>
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-marca" />
            <span className="text-xs">Aguardando leitura…</span>
            <button
              onClick={conectar}
              disabled={ocupado}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-borda px-2 py-1 text-xs font-semibold text-texto hover:bg-superficie disabled:opacity-50"
            >
              <RefreshCw size={12} /> Novo QR
            </button>
          </div>
          {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
        </div>
      </div>
    );
  }

  // desconectado
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Badge on={false} texto="Aguardando Conexão" />
        <p className="mt-1.5 text-xs text-texto-suave">
          Conecte o WhatsApp do seu negócio lendo um QR Code — leva 10 segundos.
        </p>
        {erro && <p className="mt-1.5 text-xs font-medium text-red-600">{erro}</p>}
      </div>
      <button
        onClick={conectar}
        disabled={ocupado}
        className="flex shrink-0 items-center gap-2 rounded-md bg-marca px-3 py-2 text-xs font-semibold text-bege-principal disabled:opacity-50"
      >
        {ocupado ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
        Ler QR Code
      </button>
    </div>
  );
}
