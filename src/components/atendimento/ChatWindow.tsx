"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Send,
  Zap,
  Bot,
  ChevronLeft,
  PanelRight,
  Lock,
  AlertTriangle,
  Paperclip,
  Loader2,
  FileText,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import type { Conversa, MidiaTipo } from "@/lib/conversas";

/** Escolhe o formato de gravação mais compatível com o WhatsApp que o navegador suporta. */
function escolherMimeGravacao(): string {
  if (typeof MediaRecorder === "undefined") return "";
  // ogg/opus (Firefox) e mp4/aac (Safari) o WhatsApp aceita como nota de voz;
  // webm (Chrome/Edge) é o fallback (pode depender do canal converter).
  const candidatos = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  for (const c of candidatos) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignora */
    }
  }
  return "";
}

function extDeMimeAudio(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ChatWindow({
  conversa,
  souAtendente = false,
  bloqueada = false,
  podeOverride = false,
  onAssumir,
  onDevolver,
  onEnviar,
  onAnexar,
  anexando = false,
  onVoltar,
  onAbrirPainel,
  respostasRapidas = [],
}: {
  conversa: Conversa | null;
  souAtendente?: boolean;
  bloqueada?: boolean;
  podeOverride?: boolean;
  onAssumir: () => void;
  onDevolver: () => void;
  onEnviar: (texto: string) => void;
  onAnexar?: (file: File, caption?: string) => void;
  anexando?: boolean;
  onVoltar?: () => void;
  onAbrirPainel?: () => void;
  respostasRapidas?: string[];
}) {
  const [texto, setTexto] = useState("");
  const [mostrarRespostas, setMostrarRespostas] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite reanexar o mesmo arquivo
    if (f && onAnexar) {
      const legenda = texto.trim();
      onAnexar(f, legenda || undefined); // o texto digitado vira legenda do anexo
      setTexto("");
    }
  }

  // ---- Gravação de áudio (nota de voz) ----
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erroMic, setErroMic] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelarRef = useRef(false);

  function limparGravacao() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
    setGravando(false);
    setSegundos(0);
  }

  async function iniciarGravacao() {
    setErroMic("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErroMic("Seu navegador não permite gravar áudio aqui.");
      return;
    }
    const mime = escolherMimeGravacao();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunksRef.current = [];
      cancelarRef.current = false;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const partes = chunksRef.current.slice();
        const cancelado = cancelarRef.current;
        limparGravacao();
        if (cancelado || partes.length === 0) return;
        const tipoReal = rec.mimeType || mime || "audio/webm";
        const base = tipoReal.split(";")[0];
        const blob = new Blob(partes, { type: base });
        const file = new File([blob], `nota-de-voz-${Date.now()}.${extDeMimeAudio(base)}`, {
          type: base,
        });
        if (onAnexar) onAnexar(file); // nota de voz vai sem legenda
      };
      rec.start();
      setGravando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          if (s >= 300) pararGravacao(); // corta em 5 min por segurança
          return s + 1;
        });
      }, 1000);
    } catch {
      limparGravacao();
      setErroMic("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function pararGravacao() {
    cancelarRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      limparGravacao();
    }
  }

  function cancelarGravacao() {
    cancelarRef.current = true;
    try {
      recRef.current?.stop();
    } catch {
      /* ignora */
    }
    limparGravacao();
  }

  // Encerra a gravação se a conversa trocar ou o componente desmontar.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [conversa?.id]);

  // Rola o container das mensagens até o fim quando troca de conversa ou
  // chega algo novo. Usa rAF + um respiro para esperar o layout/mídia.
  const totalMsgs = conversa?.mensagens.length ?? 0;
  const conversaId = conversa?.id ?? null;
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    const desce = () => {
      el.scrollTop = el.scrollHeight;
    };
    requestAnimationFrame(desce);
    const t = setTimeout(desce, 150); // reforço (imagens/áudio mudam a altura)
    return () => clearTimeout(t);
  }, [totalMsgs, conversaId]);

  if (!conversa) {
    return (
      <div className="hidden h-full w-full items-center justify-center bg-fundo lg:flex">
        <p className="text-sm italic text-texto-suave">
          Selecione uma conversa na fila para começar.
        </p>
      </div>
    );
  }

  const humano = conversa.comando === "humano";
  const primeiroAtendente = conversa.mensagens.findIndex(
    (m) => m.autor === "atendente"
  );
  // Estado da trava:
  // - souAtendente: eu detenho a conversa (posso escrever / devolver)
  // - bloqueada: outro membro está nela (só leitura; gestor pode forçar)
  // - livre: IA respondendo, qualquer um pode assumir

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    onEnviar(t);
    setTexto("");
  }

  return (
    <div className="flex h-full w-full flex-col bg-fundo">
      {/* Topo: contexto + botão de comando */}
      <div className="flex items-center justify-between gap-2 border-b border-borda bg-superficie px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {onVoltar && (
            <button
              onClick={onVoltar}
              aria-label="Voltar"
              className="rounded-md p-2.5 text-texto hover:bg-fundo lg:hidden"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-texto">{conversa.nome}</h2>
            <span className="text-xs text-texto-suave">{conversa.telefone}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onAbrirPainel && (
            <button
              onClick={onAbrirPainel}
              aria-label="Raio-X do cliente"
              className="rounded-md border border-borda p-2.5 text-texto hover:bg-fundo xl:hidden"
            >
              <PanelRight size={16} />
            </button>
          )}
          {bloqueada ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">
                <Lock size={13} /> Em atendimento por {conversa.atendenteNome}
              </span>
              {podeOverride && (
                <button
                  onClick={onAssumir}
                  className="flex items-center gap-2 rounded-md bg-escuro-quente px-3 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
                >
                  <Pause size={15} /> <span className="hidden sm:inline">Assumir</span>
                </button>
              )}
            </div>
          ) : souAtendente ? (
            <button
              onClick={onDevolver}
              className="flex items-center gap-2 rounded-md border border-borda px-3 py-2 text-sm font-semibold text-texto hover:bg-fundo sm:px-4"
            >
              <Play size={15} /> <span className="hidden sm:inline">Devolver para a IA</span>
            </button>
          ) : (
            <button
              onClick={onAssumir}
              className="flex items-center gap-2 rounded-md bg-marca px-3 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02] sm:px-4"
            >
              <Pause size={15} />{" "}
              <span>
                <span className="hidden sm:inline">Pausar IA e </span>Assumir
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-6 py-5">
        {conversa.mensagens.map((m, i) => {
          const divisorAqui =
            primeiroAtendente !== -1 && i === primeiroAtendente;
          return (
            <div key={m.id}>
              {divisorAqui && <Divisor />}
              <Balao
                autor={m.autor}
                texto={m.texto}
                hora={m.hora}
                midiaUrl={m.midiaUrl}
                midiaTipo={m.midiaTipo}
                status={m.status}
              />
            </div>
          );
        })}
        {humano && primeiroAtendente === -1 && <Divisor />}
      </div>

      {/* Caixa de digitação */}
      <div className="relative border-t border-borda bg-superficie px-4 py-3">
        {/* Popover de respostas rápidas */}
        {mostrarRespostas && souAtendente && !bloqueada && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMostrarRespostas(false)} />
            <div className="absolute bottom-full left-4 z-20 mb-2 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-lg border border-borda bg-superficie shadow-xl">
              <p className="border-b border-borda px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                Respostas rápidas
              </p>
              <ul className="max-h-64 overflow-y-auto py-1">
                {respostasRapidas.length === 0 ? (
                  <li className="px-3 py-2 text-xs italic text-texto-suave">
                    Nenhuma resposta cadastrada. Configure em Configurações.
                  </li>
                ) : (
                  respostasRapidas.map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => {
                          setTexto((t) => (t ? t + " " + r : r));
                          setMostrarRespostas(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-texto hover:bg-fundo"
                      >
                        {r}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        )}
        {bloqueada ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-texto-suave">
            <Lock size={14} /> Conversa em atendimento por{" "}
            <b className="text-texto">{conversa.atendenteNome}</b>.
            {podeOverride && " Clique em Assumir para tomar o atendimento."}
          </div>
        ) : souAtendente ? (
          gravando ? (
            <div className="flex items-center gap-3 py-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                Gravando… {mmss(segundos)}
              </span>
              <div className="flex-1" />
              <button
                onClick={cancelarGravacao}
                title="Cancelar gravação"
                type="button"
                className="rounded-md p-2.5 text-texto-suave transition-colors hover:bg-fundo"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={pararGravacao}
                title="Enviar áudio"
                type="button"
                className="flex items-center gap-2 rounded-md bg-marca px-4 py-2.5 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
              >
                <Send size={16} /> Enviar
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <button
                onClick={() => setMostrarRespostas((v) => !v)}
                className={`rounded-md p-2.5 transition-colors hover:bg-fundo ${
                  mostrarRespostas ? "text-marca" : "text-texto-suave"
                }`}
                title="Respostas rápidas"
                type="button"
              >
                <Zap size={18} />
              </button>
              {onAnexar && conversa.canal === "whatsapp" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    className="hidden"
                    onChange={escolherArquivo}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={anexando}
                    title="Anexar arquivo"
                    type="button"
                    className="rounded-md p-2.5 text-texto-suave transition-colors hover:bg-fundo disabled:opacity-50"
                  >
                    {anexando ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Paperclip size={18} />
                    )}
                  </button>
                  <button
                    onClick={iniciarGravacao}
                    disabled={anexando}
                    title="Gravar áudio"
                    type="button"
                    className="rounded-md p-2.5 text-texto-suave transition-colors hover:bg-fundo disabled:opacity-50"
                  >
                    <Mic size={18} />
                  </button>
                </>
              )}
              <textarea
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                placeholder="Digite sua mensagem para fechar a venda..."
                className="max-h-32 flex-1 resize-none rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca"
              />
              <button
                onClick={enviar}
                className="rounded-md bg-marca p-2.5 text-bege-principal transition-transform hover:scale-105"
              >
                <Send size={18} />
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-texto-suave">
            <Bot size={14} /> A IA está respondendo. Clique em{" "}
            <b className="text-texto">Pausar IA e Assumir</b> para escrever.
          </div>
        )}
        {erroMic && <p className="mt-2 text-xs font-medium text-red-600">{erroMic}</p>}
      </div>
    </div>
  );
}

function Divisor() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-borda" />
      <span className="text-[11px] font-medium text-texto-suave">
        Você assumiu o atendimento
      </span>
      <span className="h-px flex-1 bg-borda" />
    </div>
  );
}

function Anexo({ url, tipo }: { url: string; tipo?: MidiaTipo | null }) {
  if (tipo === "imagem") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Imagem" className="max-h-64 w-full rounded-lg object-cover" />
      </a>
    );
  }
  if (tipo === "video") {
    return <video controls src={url} className="max-h-64 w-full rounded-lg" />;
  }
  if (tipo === "audio") {
    return <audio controls src={url} className="w-56 max-w-full" />;
  }
  // documento (ou desconhecido com URL)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm font-medium underline"
    >
      <FileText size={15} /> Abrir arquivo
    </a>
  );
}

function Balao({
  autor,
  texto,
  hora,
  midiaUrl,
  midiaTipo,
  status,
}: {
  autor: "ia" | "lead" | "atendente";
  texto: string;
  hora: string;
  midiaUrl?: string | null;
  midiaTipo?: MidiaTipo | null;
  status?: "pendente" | "enviada" | "entregue" | "lida" | "falhou" | null;
}) {
  if (autor === "lead") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%] space-y-1.5 rounded-2xl rounded-tl-sm bg-superficie px-4 py-2 shadow-sm">
          {midiaUrl && <Anexo url={midiaUrl} tipo={midiaTipo} />}
          {texto && (
            <p className="text-sm text-texto break-words whitespace-pre-wrap">{texto}</p>
          )}
          <span className="block text-right text-[10px] text-texto-suave">{hora}</span>
        </div>
      </div>
    );
  }

  const ia = autor === "ia";
  return (
    <div className="flex justify-end">
      <div
        className={`max-w-[75%] space-y-1.5 rounded-2xl rounded-tr-sm px-4 py-2 ${
          ia ? "bg-cinza-200 text-texto" : "bg-marca text-bege-principal"
        }`}
      >
        <span className="flex items-center gap-1 text-[10px] font-semibold opacity-80">
          {ia ? <><Bot size={11} /> IA</> : <>👤 Atendente</>}
        </span>
        {midiaUrl && <Anexo url={midiaUrl} tipo={midiaTipo} />}
        {texto && <p className="text-sm break-words whitespace-pre-wrap">{texto}</p>}
        <span
          className={`block text-right text-[10px] ${
            ia ? "text-texto-suave" : "text-bege-principal/70"
          }`}
        >
          {hora}
        </span>
        {status === "falhou" && (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-red-600">
            <AlertTriangle size={10} /> Não entregue no canal
          </span>
        )}
      </div>
    </div>
  );
}
