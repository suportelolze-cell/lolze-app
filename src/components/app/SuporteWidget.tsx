"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Headset } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

// WhatsApp do suporte humano (ajuste o número se mudar).
const WHATSAPP_SUPORTE =
  "https://wa.me/5519992657109?text=" +
  encodeURIComponent("Olá! Preciso de suporte na Lolze.");

const SAUDACAO: Msg = {
  role: "assistant",
  content:
    "Oi! Sou o assistente da Lolze 👋 Posso te ajudar a usar a plataforma: configurar o agente, conectar o WhatsApp, base de conhecimento, agenda… Manda sua dúvida! Se eu não resolver, te passo pra uma pessoa.",
};

export function SuporteWidget() {
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, enviando, aberto]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    const novo = [...msgs, { role: "user" as const, content: t }];
    setMsgs(novo);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/suporte/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novo }),
      });
      const data = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: String(data.reply ?? "…") }]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Falha de conexão 😅 Se for urgente, clique em *Falar com uma pessoa* aqui em cima.",
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        aria-label="Abrir suporte"
        title="Suporte Lolze"
        className="no-print fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-escuro-quente text-bege-principal shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="no-print fixed bottom-6 right-6 z-40 flex h-[30rem] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl border border-borda bg-superficie shadow-2xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 bg-escuro-quente px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-[11px] font-bold text-bege-principal">
            IA
          </span>
          <div>
            <p className="text-sm font-bold text-bege-principal">Suporte Lolze</p>
            <p className="text-[11px] text-bege-principal/60">assistente · responde na hora</p>
          </div>
        </div>
        <button
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="rounded-md p-2 text-bege-principal/80 hover:bg-bege-principal/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Falar com uma pessoa */}
      <a
        href={WHATSAPP_SUPORTE}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 border-b border-borda bg-marca-suave/40 py-2 text-xs font-semibold text-marca hover:bg-marca-suave/70"
      >
        <Headset size={14} /> Falar com uma pessoa (WhatsApp)
      </a>

      {/* Mensagens */}
      <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-fundo px-3 py-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-marca text-bege-principal"
                  : "rounded-bl-sm bg-superficie text-texto shadow-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex items-center gap-2 text-xs text-texto-suave">
            <Loader2 size={13} className="animate-spin" /> digitando…
          </div>
        )}
      </div>

      {/* Entrada */}
      <div className="flex items-center gap-2 border-t border-borda bg-superficie px-3 py-2.5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Digite sua dúvida…"
          className="min-w-0 flex-1 rounded-full border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca text-bege-principal transition-transform hover:scale-105 disabled:opacity-50"
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
