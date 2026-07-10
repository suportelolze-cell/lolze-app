"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SAUDACAO: Msg = {
  role: "assistant",
  content: "Olá! Vi que você tem interesse em escalar sua operação comercial. Como eu posso te ajudar hoje?",
};

function Card({ titulo, italico, texto }: { titulo: string; italico: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-5 shadow-sm">
      <h3 className="font-corpo text-base font-bold text-texto">
        {titulo} <span className="font-display font-medium italic text-marca">{italico}</span>
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">{texto}</p>
    </div>
  );
}

export function ProvaReal() {
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [encerrado, setEncerrado] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  // Mantém o chat "colado" na última mensagem — rolando SÓ o container interno,
  // nunca a janela (senão a página inteira pulava pra cá ao carregar).
  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, enviando]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando || encerrado) return;
    const novo = [...msgs, { role: "user" as const, content: t }];
    setMsgs(novo);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novo }),
      });
      const data = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: String(data.reply ?? "…") }]);
      if (data.encerrado) setEncerrado(true);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Falha de conexão — tenta de novo? 😉" },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="px-6 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        {/* Lado esquerdo: copy + cards */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-texto-suave/70">
            Prova real
          </p>
          <h2 className="font-corpo text-3xl font-semibold leading-tight text-texto sm:text-4xl">
            Não compre promessas.
            <br /> Teste a velocidade.
          </h2>
          <p className="mt-4 max-w-md text-texto-suave">
            Converse com nosso agente de IA ao lado. Tente desviá-lo do assunto. Veja como ele
            conduz a conversa de volta para o agendamento. É exatamente assim que vai funcionar na
            sua empresa.
          </p>

          <div className="mt-8 space-y-4">
            <Card
              titulo="Responde"
              italico="em segundos"
              texto="Atendimento automático em tempo real, sem fila de espera nem horário comercial."
            />
            <Card
              titulo="Treinada para o"
              italico="seu negócio"
              texto="A IA é personalizada com o seu roteiro de vendas, sua agenda e suas regras."
            />
            <Card
              titulo="Funciona"
              italico="24/7"
              texto="Atende de madrugada, fim de semana e feriado, sem pausar e sem custo trabalhista."
            />
          </div>
        </div>

        {/* Lado direito: chat ao vivo */}
        <div>
          <div className="flex h-[30rem] flex-col overflow-hidden rounded-3xl border border-borda bg-superficie shadow-xl">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 bg-escuro-quente px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marca text-sm font-bold text-bege-principal">
                A
              </span>
              <div>
                <div className="text-sm font-bold text-bege-principal">Atendente · Abner Oliveira</div>
                <div className="flex items-center gap-1.5 text-[11px] text-bege-principal/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-marca" /> online · respondendo agora
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto bg-fundo px-4 py-4">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-marca text-bege-principal"
                        : "rounded-bl-sm bg-superficie text-texto shadow-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                  {i === 0 && <span className="mt-1 text-[10px] text-texto-suave">Agora</span>}
                </div>
              ))}
              {enviando && (
                <div className="flex items-center gap-2 text-xs text-texto-suave">
                  <Loader2 size={13} className="animate-spin" /> digitando…
                </div>
              )}
            </div>

            {/* Entrada */}
            <div className="flex items-center gap-2 border-t border-borda bg-superficie px-3 py-3">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                disabled={encerrado}
                placeholder={encerrado ? "Bora aplicar pra continuar 🚀" : "Digite sua mensagem aqui…"}
                className="min-w-0 flex-1 rounded-full border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca disabled:opacity-60"
              />
              <button
                onClick={enviar}
                disabled={enviando || encerrado || !texto.trim()}
                aria-label="Enviar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca text-bege-principal transition-transform hover:scale-105 disabled:opacity-50"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-texto-suave">
            Demo ao vivo · seu agente será treinado com seus serviços e agenda reais.
          </p>
        </div>
      </div>
    </section>
  );
}
