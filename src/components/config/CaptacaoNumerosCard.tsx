"use client";

import { useEffect, useRef, useState } from "react";
import { Radar, QrCode, Loader2, Trash2, RefreshCw } from "lucide-react";
import {
  conectarNumeroCaptacao,
  statusNumeroCaptacao,
  removerNumeroCaptacao,
} from "@/lib/captacao/actions";

function Badge({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        on ? "bg-marca-suave text-marca" : "bg-superficie text-texto-suave"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-marca" : "bg-texto-suave/40"}`} />
      {on ? "Conectado" : "Aguardando"}
    </span>
  );
}

export function CaptacaoNumerosCard({ instancias, max }: { instancias: string[]; max: number }) {
  const [lista, setLista] = useState<string[]>(instancias);
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [qr, setQr] = useState<string | null>(null);
  const [conectandoInst, setConectandoInst] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Checa o estado de cada número ao montar / quando a lista muda.
  useEffect(() => {
    (async () => {
      for (const inst of lista) {
        const r = await statusNumeroCaptacao(inst);
        setStatuses((s) => ({ ...s, [inst]: r.conectado }));
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [lista]);

  const cheio = lista.length >= max;

  async function conectarNovo() {
    setOcupado(true);
    setErro("");
    setQr(null);
    try {
      const r = await conectarNumeroCaptacao();
      if (!r.ok) {
        setErro(r.erro ?? "Falha ao conectar.");
        return;
      }
      if (r.instancia && !lista.includes(r.instancia)) setLista((l) => [...l, r.instancia!]);
      if (r.conectado && r.instancia) {
        setStatuses((s) => ({ ...s, [r.instancia!]: true }));
        return;
      }
      if (r.qr && r.instancia) {
        setQr(r.qr);
        setConectandoInst(r.instancia);
        iniciarPoll(r.instancia);
      }
    } finally {
      setOcupado(false);
    }
  }

  function iniciarPoll(inst: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r = await statusNumeroCaptacao(inst);
      if (r.conectado) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatuses((s) => ({ ...s, [inst]: true }));
        setQr(null);
        setConectandoInst(null);
      }
    }, 3000);
  }

  async function remover(inst: string) {
    if (!confirm("Remover este número de captação?")) return;
    await removerNumeroCaptacao(inst);
    setLista((l) => l.filter((n) => n !== inst));
    if (conectandoInst === inst) {
      setQr(null);
      setConectandoInst(null);
    }
  }

  if (max <= 0) {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Seu plano atual não inclui números de captação (prospecção ativa).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-texto-suave">
          Conecte chips DEDICADOS só para prospecção (um WhatsApp por número). Usados:{" "}
          <b>{lista.length}</b> de <b>{max}</b>.
        </p>
        <button
          onClick={conectarNovo}
          disabled={ocupado || cheio}
          className="flex shrink-0 items-center gap-2 rounded-md bg-marca px-3 py-2 text-xs font-semibold text-bege-principal disabled:opacity-50"
        >
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
          {cheio ? "Limite do plano atingido" : "Conectar novo número"}
        </button>
      </div>

      {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}

      {/* QR em andamento */}
      {qr && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-borda bg-fundo p-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code" className="h-40 w-40 rounded-lg border border-borda bg-white p-2" />
          <div className="flex-1 text-sm text-texto-suave">
            <p className="font-semibold text-texto">Escaneie com o chip DEDICADO</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs">
              <li>Abra o WhatsApp do número de prospecção</li>
              <li>Aparelhos conectados → Conectar um aparelho</li>
              <li>Aponte a câmera para este QR</li>
            </ol>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Loader2 size={13} className="animate-spin text-marca" /> Aguardando leitura…
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {lista.length === 0 && (
          <p className="rounded-md bg-fundo px-3 py-2 text-xs text-texto-suave">
            Nenhum número conectado ainda.
          </p>
        )}
        {lista.map((inst, i) => (
          <div
            key={inst}
            className="flex items-center justify-between gap-3 rounded-md border border-borda bg-fundo px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-marca-suave text-marca">
                <Radar size={14} />
              </span>
              <span className="text-sm font-medium text-texto">Número de captação {i + 1}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge on={statuses[inst] ?? false} />
              {!(statuses[inst] ?? false) && conectandoInst !== inst && (
                <button
                  onClick={() => {
                    setConectandoInst(inst);
                    (async () => {
                      const r = await conectarNumeroCaptacao(); // gera QR novo p/ o próximo slot
                      if (r.qr && r.instancia) {
                        setQr(r.qr);
                        setConectandoInst(r.instancia);
                        iniciarPoll(r.instancia);
                      }
                    })();
                  }}
                  aria-label="Reconectar"
                  className="text-texto-suave hover:text-marca"
                  title="Gerar QR"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              <button
                onClick={() => remover(inst)}
                aria-label="Remover"
                className="text-texto-suave hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
