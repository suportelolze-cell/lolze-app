"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { type Conversa } from "@/lib/conversas";
import {
  assumirConversa,
  devolverConversa,
  enviarMensagem,
  recarregarConversas,
} from "@/lib/supabase/crm-actions";
import { crmBrowser } from "@/lib/supabase/browser";
import { ConversaList, type Filtro } from "./ConversaList";
import { ChatWindow } from "./ChatWindow";
import { LeadPanel } from "./LeadPanel";

function agora() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Beep curto de notificação (Web Audio — sem arquivo). Reaproveita o contexto. */
let _audioCtx: AudioContext | null = null;
function tocarBeep() {
  try {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {
    /* navegador bloqueou áudio até a 1ª interação — badge/título continuam */
  }
}

export function Atendimento({
  initialConversas,
  currentUserId,
  podeOverride = false,
  respostasRapidas = [],
}: {
  initialConversas: Conversa[];
  currentUserId: string;
  podeOverride?: boolean;
  respostasRapidas?: string[];
}) {
  const [conversas, setConversas] = useState<Conversa[]>(initialConversas);
  const [selecionadaId, setSelecionadaId] = useState<number | null>(
    initialConversas[0]?.id ?? null
  );
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [painelAberto, setPainelAberto] = useState(false); // Raio-X no mobile
  const [aviso, setAviso] = useState("");
  const enviando = useRef(false); // evita sobrescrever envio otimista em andamento
  const snapshotRef = useRef<{ msgs: number; aguardando: number } | null>(null);

  // Notificação: som quando chega mensagem nova de lead OU sobe "aguardando humano";
  // contador no título da aba (badge mesmo com a aba em segundo plano).
  useEffect(() => {
    const totalLeadMsgs = conversas.reduce(
      (s, c) => s + c.mensagens.filter((m) => m.autor === "lead").length,
      0
    );
    const aguardandoHumano = conversas.filter((c) => c.precisaHumano).length;
    const prev = snapshotRef.current;
    if (prev && (totalLeadMsgs > prev.msgs || aguardandoHumano > prev.aguardando)) {
      tocarBeep();
    }
    snapshotRef.current = { msgs: totalLeadMsgs, aguardando: aguardandoHumano };
    document.title = aguardandoHumano > 0 ? `(${aguardandoHumano}) Central · Lolze` : "Central · Lolze";
    return () => {
      document.title = "Lolze";
    };
  }, [conversas]);

  // Atualiza a lista preservando seleção (chamado pelo realtime e pelo poll).
  const recarregar = useCallback(async () => {
    if (enviando.current) return;
    try {
      const frescas = await recarregarConversas();
      setConversas(frescas);
    } catch {
      /* silencioso: o poll tenta de novo */
    }
  }, []);

  // Chat ao vivo: Realtime (instantâneo) + poll de segurança a cada 8s.
  useEffect(() => {
    const canal = crmBrowser
      .channel("atendimento-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_mensagens" }, () =>
        recarregar()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "app_leads" }, () =>
        recarregar()
      )
      .subscribe();
    const intervalo = setInterval(recarregar, 8000);
    return () => {
      clearInterval(intervalo);
      crmBrowser.removeChannel(canal);
    };
  }, [recarregar]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      const porFiltro =
        filtro === "todas" ||
        (filtro === "quentes" && c.temperatura === "quente") ||
        (filtro === "ia" && c.comando === "ia") ||
        (filtro === "comigo" && c.atendenteId === currentUserId);
      const porBusca =
        !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q);
      return porFiltro && porBusca;
    });
  }, [conversas, filtro, busca, currentUserId]);

  const selecionada = conversas.find((c) => c.id === selecionadaId) ?? null;

  function patch(id: number, fn: (c: Conversa) => Conversa) {
    setConversas((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }

  async function onAssumir() {
    if (!selecionada) return;
    setAviso("");
    const id = selecionada.id;
    const r = await assumirConversa(id);
    if (r.ok) {
      patch(id, (c) => ({
        ...c,
        comando: "humano",
        precisaHumano: false,
        atendenteId: currentUserId,
        atendenteNome: "Você",
      }));
    } else {
      setAviso(r.erro ?? "Não foi possível assumir a conversa.");
    }
  }

  async function onDevolver() {
    if (!selecionada) return;
    const id = selecionada.id;
    patch(id, (c) => ({ ...c, comando: "ia", atendenteId: null, atendenteNome: "" }));
    try {
      await devolverConversa(id);
    } catch {
      setAviso("Não foi possível devolver para a IA.");
    }
  }

  async function onEnviar(texto: string) {
    if (!selecionada) return;
    const id = selecionada.id;
    const tempId = Date.now();
    enviando.current = true;
    patch(id, (c) => ({
      ...c,
      mensagens: [...c.mensagens, { id: tempId, autor: "atendente", texto, hora: agora() }],
    }));
    const r = await enviarMensagem(id, texto);
    enviando.current = false;
    if (!r.ok) {
      // desfaz a mensagem otimista e avisa
      patch(id, (c) => ({ ...c, mensagens: c.mensagens.filter((m) => m.id !== tempId) }));
      setAviso(r.erro ?? "Não foi possível enviar.");
    } else {
      recarregar(); // sincroniza com o servidor (id real da mensagem)
    }
  }

  const ativas = conversas.length;
  const aguardando = conversas.filter((c) => c.precisaHumano).length;

  const souAtendente = !!selecionada && selecionada.atendenteId === currentUserId;
  const bloqueada =
    !!selecionada &&
    selecionada.atendenteId !== null &&
    selecionada.atendenteId !== currentUserId;

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col lg:h-[calc(100vh-7rem)]">
      {/* Cabeçalho */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium italic tracking-tight text-texto">
            Central de Atendimento
          </h1>
          <p className="mt-1 text-texto-suave">
            Assuma a conversa no momento certo e transforme o lead aquecido em
            cliente pagante.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-texto-suave">
            <span className="h-2 w-2 rounded-full bg-marca" /> {ativas} ativas
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-amber-600">
            🔥 {aguardando} aguardando humano
          </span>
        </div>
      </header>

      {aviso && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} /> {aviso}
          </span>
          <button onClick={() => setAviso("")} aria-label="Fechar" className="shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3 painéis (responsivo: lista⟷chat no mobile, painel no xl / overlay no mobile) */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-borda">
        {/* Lista */}
        <div className={`${selecionada ? "hidden lg:block" : "block"} w-full shrink-0 lg:w-80`}>
          <ConversaList
            conversas={lista}
            selecionadaId={selecionadaId}
            onSelect={setSelecionadaId}
            busca={busca}
            setBusca={setBusca}
            filtro={filtro}
            setFiltro={setFiltro}
            currentUserId={currentUserId}
          />
        </div>

        {/* Chat */}
        <div className={`${selecionada ? "block" : "hidden lg:block"} min-w-0 flex-1`}>
          <ChatWindow
            conversa={selecionada}
            souAtendente={souAtendente}
            bloqueada={bloqueada}
            podeOverride={podeOverride}
            onAssumir={onAssumir}
            onDevolver={onDevolver}
            onEnviar={onEnviar}
            onVoltar={() => setSelecionadaId(null)}
            onAbrirPainel={() => setPainelAberto(true)}
            respostasRapidas={respostasRapidas}
          />
        </div>

        {/* Raio-X (desktop largo) */}
        <div className="hidden w-80 shrink-0 xl:block">
          <LeadPanel conversa={selecionada} />
        </div>
      </div>

      {/* Raio-X como overlay (mobile/tablet) */}
      {painelAberto && selecionada && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-escuro-quente/40"
            onClick={() => setPainelAberto(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm shadow-2xl">
            <button
              onClick={() => setPainelAberto(false)}
              aria-label="Fechar"
              className="absolute right-3 top-3 z-10 rounded-md bg-fundo p-1.5 text-texto-suave hover:text-texto"
            >
              <X size={18} />
            </button>
            <LeadPanel conversa={selecionada} />
          </div>
        </div>
      )}
    </div>
  );
}
