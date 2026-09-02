"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { type Conversa } from "@/lib/conversas";
import {
  assumirConversa,
  devolverConversa,
  enviarMensagem,
  recarregarConversas,
  carregarHistoricoConversa,
} from "@/lib/supabase/crm-actions";
import { criarUploadAnexo, enviarAnexo } from "@/lib/atendimento/anexos";
import { tipoDeMime, dentroDoLimite, extDeNome, limiteMb } from "@/lib/atendimento/midia-core";
import { mesclarPorId } from "@/lib/atendimento/mensagens-core";
import { crmBrowser } from "@/lib/supabase/browser";
import type { Mensagem } from "@/lib/conversas";
import { ConversaList, type Filtro } from "./ConversaList";
import { ChatWindow } from "./ChatWindow";
import { LeadPanel } from "./LeadPanel";
import { IaSwitchPill } from "@/components/config/IaSwitchCard";
import { PageHeader, Acento, Badge, StatusDot } from "@/components/ui";
import { descricaoSecao, type PlaybookCopy } from "@/lib/copy/secoes";

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
  conversaInicial = null,
  iaAtiva = true,
  playbook = "servico_local",
}: {
  initialConversas: Conversa[];
  currentUserId: string;
  podeOverride?: boolean;
  respostasRapidas?: string[];
  conversaInicial?: number | null;
  iaAtiva?: boolean;
  playbook?: PlaybookCopy;
}) {
  const [conversas, setConversas] = useState<Conversa[]>(initialConversas);
  const [selecionadaId, setSelecionadaId] = useState<number | null>(
    (conversaInicial && initialConversas.some((c) => c.id === conversaInicial)
      ? conversaInicial
      : initialConversas[0]?.id) ?? null
  );
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [painelAberto, setPainelAberto] = useState(false); // Raio-X no mobile
  const [aviso, setAviso] = useState("");
  const [anexando, setAnexando] = useState(false);
  // Histórico COMPLETO da conversa aberta (getConversas só embute as últimas 40).
  // Re-buscado a cada poll enquanto aberta → sempre completo, sem lacuna e com
  // URLs de mídia renovadas. Guarda só UMA conversa (memória limitada).
  const [historicoAberto, setHistoricoAberto] = useState<{ id: number; mensagens: Mensagem[] } | null>(null);
  const selIdRef = useRef<number | null>(selecionadaId);
  useEffect(() => {
    selIdRef.current = selecionadaId;
  }, [selecionadaId]);
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
    const selId = selIdRef.current;
    try {
      // Recarrega a lista (40/lead) e, em paralelo, o histórico completo da
      // conversa aberta — assim ela nunca fica truncada nem com URL expirada.
      const [frescas, hist] = await Promise.all([
        recarregarConversas(),
        selId != null ? carregarHistoricoConversa(selId).catch(() => null) : Promise.resolve(null),
      ]);
      setConversas(frescas);
      if (hist && selId != null && selIdRef.current === selId) {
        setHistoricoAberto({ id: selId, mensagens: hist });
      }
    } catch {
      /* silencioso: o poll tenta de novo */
    }
  }, []);

  // Coalesce refetches: uma resposta multi-parte do SDR dispara vários eventos
  // realtime; o debounce evita recarregar getConversas inteiro 3-5x em segundos.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agendarRecarga = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => recarregar(), 500);
  }, [recarregar]);

  // Chat ao vivo: Realtime (instantâneo, debounced) + poll de segurança a cada
  // 15s que PAUSA com a aba oculta (não refaz tudo o dia todo em 2º plano).
  useEffect(() => {
    const canal = crmBrowser
      .channel("atendimento-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_mensagens" }, () =>
        agendarRecarga()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "app_leads" }, () =>
        agendarRecarga()
      )
      .subscribe();
    const intervalo = setInterval(() => {
      if (!document.hidden) recarregar();
    }, 15000);
    const aoVoltar = () => {
      if (!document.hidden) recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(intervalo);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", aoVoltar);
      crmBrowser.removeChannel(canal);
    };
  }, [recarregar, agendarRecarga]);

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

  // Ao ABRIR uma conversa, carrega o histórico completo na hora (o poll o mantém
  // fresco depois). Sinaliza ao operador se a leitura falhar (não trunca calado).
  useEffect(() => {
    if (selecionadaId == null) {
      setHistoricoAberto(null);
      return;
    }
    let vivo = true;
    carregarHistoricoConversa(selecionadaId)
      .then((full) => {
        if (vivo) setHistoricoAberto({ id: selecionadaId, mensagens: full });
      })
      .catch(() => {
        if (vivo)
          setAviso(
            "Não consegui carregar o histórico completo desta conversa. Mostrando as mensagens recentes."
          );
      });
    return () => {
      vivo = false;
    };
  }, [selecionadaId]);

  // Conversa a exibir: mescla o histórico completo (quando já carregado para ESTA
  // conversa) com as mensagens ao vivo/otimistas (recentes vencem: status/URL atuais).
  const selecionadaExibida = useMemo(() => {
    if (!selecionada) return null;
    const base = historicoAberto?.id === selecionada.id ? historicoAberto.mensagens : [];
    if (base.length === 0) return selecionada;
    return { ...selecionada, mensagens: mesclarPorId(base, selecionada.mensagens) };
  }, [selecionada, historicoAberto]);

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

  async function onAnexar(file: File, caption?: string) {
    if (!selecionada) return;
    setAviso("");
    const mime = file.type || "application/octet-stream"; // alguns SOs não preenchem o MIME
    const tipo = tipoDeMime(mime);
    if (!tipo) {
      setAviso("Tipo de arquivo não suportado.");
      return;
    }
    if (!dentroDoLimite(tipo, file.size)) {
      setAviso(`Arquivo muito grande para ${tipo}. Limite: ${limiteMb(tipo)} MB.`);
      return;
    }
    const id = selecionada.id;
    const tempId = Date.now();
    setAnexando(true);
    enviando.current = true;
    // Bolha otimista enquanto o arquivo sobe (reconciliada no recarregar).
    patch(id, (c) => ({
      ...c,
      mensagens: [
        ...c.mensagens,
        { id: tempId, autor: "atendente", texto: caption || `📎 ${file.name}`, hora: agora() },
      ],
    }));
    try {
      const up = await criarUploadAnexo(id, extDeNome(file.name));
      if (!up.ok || !up.path || !up.token) {
        setAviso(up.erro ?? "Não foi possível preparar o envio.");
        return;
      }
      const { error } = await crmBrowser.storage
        .from("midias")
        .uploadToSignedUrl(up.path, up.token, file);
      if (error) {
        setAviso("Falha no upload do arquivo.");
        return;
      }
      const r = await enviarAnexo(id, up.path, mime, file.name, caption);
      if (!r.ok) {
        // O servidor (service_role) limpa o órfão do Storage em caso de falha.
        setAviso(r.erro ?? "Não foi possível enviar o anexo.");
      } else if (r.aviso) {
        setAviso(r.aviso);
      }
    } catch {
      setAviso("Não foi possível enviar o anexo.");
    } finally {
      setAnexando(false);
      enviando.current = false;
      patch(id, (c) => ({ ...c, mensagens: c.mensagens.filter((m) => m.id !== tempId) }));
      recarregar();
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
      <PageHeader
        titulo={
          <>
            Central de <Acento>Atendimento</Acento>
          </>
        }
        descricao={descricaoSecao("atendimento", playbook)}
        acao={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {podeOverride && <IaSwitchPill inicial={iaAtiva} />}
            <Badge tom="neutro">
              <StatusDot tom="menta" /> {ativas} ativas
            </Badge>
            <Badge tom={aguardando > 0 ? "atencao" : "neutro"}>
              🔥 {aguardando} aguardando humano
            </Badge>
          </div>
        }
      />

      {aviso && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} /> {aviso}
          </span>
          <button onClick={() => setAviso("")} aria-label="Fechar" className="shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3 painéis (responsivo: lista⟷chat no mobile, painel no xl / overlay no mobile) */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-borda bg-superficie shadow-card">
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
            conversa={selecionadaExibida}
            souAtendente={souAtendente}
            bloqueada={bloqueada}
            podeOverride={podeOverride}
            onAssumir={onAssumir}
            onDevolver={onDevolver}
            onEnviar={onEnviar}
            onAnexar={onAnexar}
            anexando={anexando}
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
