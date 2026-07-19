"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Send, Zap, Bot, ChevronLeft, PanelRight, Lock, AlertTriangle } from "lucide-react";
import type { Conversa } from "@/lib/conversas";

export function ChatWindow({
  conversa,
  souAtendente = false,
  bloqueada = false,
  podeOverride = false,
  onAssumir,
  onDevolver,
  onEnviar,
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
  onVoltar?: () => void;
  onAbrirPainel?: () => void;
  respostasRapidas?: string[];
}) {
  const [texto, setTexto] = useState("");
  const [mostrarRespostas, setMostrarRespostas] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

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
              className="rounded-md p-1.5 text-texto hover:bg-fundo lg:hidden"
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
              className="rounded-md border border-borda p-2 text-texto hover:bg-fundo xl:hidden"
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
      <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
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
          <div className="flex items-end gap-2">
            <button
              onClick={() => setMostrarRespostas((v) => !v)}
              className={`rounded-md p-2 transition-colors hover:bg-fundo ${
                mostrarRespostas ? "text-marca" : "text-texto-suave"
              }`}
              title="Respostas rápidas"
              type="button"
            >
              <Zap size={18} />
            </button>
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
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-texto-suave">
            <Bot size={14} /> A IA está respondendo. Clique em{" "}
            <b className="text-texto">Pausar IA e Assumir</b> para escrever.
          </div>
        )}
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

function MidiaLead({
  midiaUrl,
  midiaTipo,
  texto,
}: {
  midiaUrl?: string | null;
  midiaTipo?: "imagem" | "audio" | "documento" | null;
  texto: string;
}) {
  if (!midiaUrl) return <p className="text-sm text-texto">{texto}</p>;
  if (midiaTipo === "imagem") {
    return (
      <a href={midiaUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={midiaUrl}
          alt="Imagem enviada pelo cliente"
          className="max-h-64 w-full rounded-lg object-cover"
        />
      </a>
    );
  }
  if (midiaTipo === "audio") {
    return (
      <div>
        <audio controls src={midiaUrl} className="w-56 max-w-full" />
        {texto && <p className="mt-1 text-xs italic text-texto-suave">📝 {texto}</p>}
      </div>
    );
  }
  // documento
  return (
    <a
      href={midiaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm font-medium text-marca underline"
    >
      📄 Abrir documento
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
  midiaTipo?: "imagem" | "audio" | "documento" | null;
  status?: "pendente" | "enviada" | "entregue" | "lida" | "falhou" | null;
}) {
  if (autor === "lead") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-superficie px-4 py-2 shadow-sm">
          <MidiaLead midiaUrl={midiaUrl} midiaTipo={midiaTipo} texto={texto} />
          <span className="mt-1 block text-right text-[10px] text-texto-suave">
            {hora}
          </span>
        </div>
      </div>
    );
  }

  const ia = autor === "ia";
  return (
    <div className="flex justify-end">
      <div
        className={`max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2 ${
          ia ? "bg-cinza-200 text-texto" : "bg-marca text-bege-principal"
        }`}
      >
        <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold opacity-80">
          {ia ? <><Bot size={11} /> IA</> : <>👤 Atendente</>}
        </span>
        <p className="text-sm">{texto}</p>
        <span
          className={`mt-1 block text-right text-[10px] ${
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
