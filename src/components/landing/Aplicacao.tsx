"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { registrarAplicacao } from "@/lib/landing/aplicacao";

// Troque pelo número real da operação (formato 55 + DDD + número)
const WHATSAPP_NUM = "5519992657109";

type Resp = {
  nome: string;
  telefone: string;
  negocio: string;
  faturamento: string;
  trafego: string;
  dificuldade: string;
};
const VAZIO: Resp = { nome: "", telefone: "", negocio: "", faturamento: "", trafego: "", dificuldade: "" };

const PERGUNTAS = [
  {
    chave: "negocio" as const,
    titulo: "Que tipo de negócio você tem?",
    ops: ["Clínica / Saúde", "Estética", "Advocacia", "Academia / Fitness", "Energia Solar", "Outro serviço"],
  },
  {
    chave: "faturamento" as const,
    titulo: "Qual seu faturamento mensal aproximado?",
    ops: ["Até R$ 20 mil", "R$ 20 mil a R$ 50 mil", "R$ 50 mil a R$ 100 mil", "Acima de R$ 100 mil"],
  },
  {
    chave: "trafego" as const,
    titulo: "Você já investe em tráfego pago?",
    ops: ["Sim, todo mês", "Às vezes / já testei", "Ainda não invisto"],
  },
  {
    chave: "dificuldade" as const,
    titulo: "Qual a sua maior dificuldade hoje?",
    ops: [
      "Leads não respondem / esfriam",
      "Faltas e no-show",
      "Equipe desorganizada no atendimento",
      "Não sei de onde vem meu cliente",
      "Quero escalar e não dou conta",
    ],
  },
];

const TOTAL = PERGUNTAS.length + 1; // nome + perguntas

export function Aplicacao() {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0); // 0 = nome, 1..4 = perguntas, 5 = final
  const [r, setR] = useState<Resp>(VAZIO);
  const [outroAberto, setOutroAberto] = useState(false); // campo "Outro serviço"
  const [outroTxt, setOutroTxt] = useState("");
  const capturadoRef = useRef(false);

  useEffect(() => {
    function abrir() {
      setR(VAZIO);
      setPasso(0);
      setOutroAberto(false);
      setOutroTxt("");
      capturadoRef.current = false;
      setAberto(true);
    }
    window.addEventListener("abrir-aplicacao", abrir);
    return () => window.removeEventListener("abrir-aplicacao", abrir);
  }, []);

  // Captura a aplicação como lead no CRM ao chegar no passo final (mesmo que a
  // pessoa NÃO abra o WhatsApp). Roda uma vez por aplicação.
  useEffect(() => {
    if (passo === TOTAL && !capturadoRef.current) {
      capturadoRef.current = true;
      registrarAplicacao({
        nome: r.nome,
        telefone: r.telefone,
        negocio: r.negocio,
        faturamento: r.faturamento,
        trafego: r.trafego,
        dificuldade: r.dificuldade,
      }).catch(() => {});
      // Conversão no Pixel da Meta (otimiza anúncio para "quem aplica").
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      w.fbq?.("track", "Lead");
    }
  }, [passo, r]);

  function responder(chave: keyof Resp, valor: string) {
    setR((p) => ({ ...p, [chave]: valor }));
    setPasso((p) => p + 1);
  }

  function confirmarOutro() {
    const v = outroTxt.trim();
    if (!v) return;
    setOutroAberto(false);
    setOutroTxt("");
    responder("negocio", v);
  }

  function irWhatsApp() {
    const msg =
      "Olá! Vim pela landing e quero aplicar para uma Sessão Estratégica Lolze.\n\n" +
      `Nome: ${r.nome || "(não informado)"}\n` +
      `Negócio: ${r.negocio}\n` +
      `Faturamento/mês: ${r.faturamento}\n` +
      `Tráfego pago: ${r.trafego}\n` +
      `Maior dificuldade: ${r.dificuldade}`;
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`, "_blank");
    setAberto(false);
  }

  if (!aberto) return null;

  const ehFinal = passo === TOTAL;
  const progresso = Math.round((Math.min(passo, TOTAL) / TOTAL) * 100);
  const podeIniciar = r.nome.trim().length > 1 && r.telefone.replace(/\D/g, "").length >= 10;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-escuro-quente/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-superficie shadow-2xl sm:rounded-2xl">
        {/* Topo: progresso + fechar */}
        <div className="flex items-center justify-between gap-4 border-b border-borda px-5 py-3">
          <div className="flex items-center gap-2">
            {passo > 0 && !ehFinal && (
              <button
                onClick={() => (outroAberto ? setOutroAberto(false) : setPasso((p) => p - 1))}
                aria-label="Voltar"
                className="rounded-md p-1 text-texto-suave hover:bg-fundo"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <Logo variante="lockup" tom="escuro" height={18} />
          </div>
          <button
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-texto-suave hover:bg-fundo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 w-full bg-borda">
          <div className="h-full bg-marca transition-all duration-300" style={{ width: `${progresso}%` }} />
        </div>

        <div className="p-6">
          {/* Passo 0: nome */}
          {passo === 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-marca">Aplicação rápida</p>
              <h3 className="mt-1 font-display text-2xl font-medium italic text-texto">
                Como podemos te chamar?
              </h3>
              <p className="mt-1 text-sm text-texto-suave">Leva 30 segundos. Sem compromisso.</p>
              <input
                autoFocus
                value={r.nome}
                onChange={(e) => setR((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Seu nome"
                className="mt-5 w-full rounded-lg border border-borda bg-fundo px-4 py-3 text-sm text-texto outline-none focus:border-marca"
              />
              <input
                type="tel"
                value={r.telefone}
                onChange={(e) => setR((p) => ({ ...p, telefone: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && podeIniciar && setPasso(1)}
                placeholder="Seu WhatsApp (com DDD)"
                className="mt-3 w-full rounded-lg border border-borda bg-fundo px-4 py-3 text-sm text-texto outline-none focus:border-marca"
              />
              <button
                onClick={() => podeIniciar && setPasso(1)}
                disabled={!podeIniciar}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
              >
                Começar <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Passos 1..4: perguntas com opções */}
          {passo >= 1 && passo <= PERGUNTAS.length && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-marca">
                Pergunta {passo} de {PERGUNTAS.length}
              </p>
              <h3 className="mt-1 font-display text-2xl font-medium italic leading-tight text-texto">
                {outroAberto ? "Qual é o seu nicho ou serviço?" : PERGUNTAS[passo - 1].titulo}
              </h3>

              {outroAberto ? (
                <div className="mt-5">
                  <input
                    autoFocus
                    value={outroTxt}
                    onChange={(e) => setOutroTxt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && outroTxt.trim() && confirmarOutro()}
                    placeholder="Ex.: Pet shop, Estúdio de tatuagem, Imobiliária..."
                    className="w-full rounded-lg border border-borda bg-fundo px-4 py-3 text-sm text-texto outline-none focus:border-marca"
                  />
                  <button
                    onClick={confirmarOutro}
                    disabled={!outroTxt.trim()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-marca py-3 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
                  >
                    Continuar <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-2.5">
                  {PERGUNTAS[passo - 1].ops.map((op) => (
                    <button
                      key={op}
                      onClick={() =>
                        PERGUNTAS[passo - 1].chave === "negocio" && op === "Outro serviço"
                          ? setOutroAberto(true)
                          : responder(PERGUNTAS[passo - 1].chave, op)
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-borda bg-fundo px-4 py-3 text-left text-sm font-medium text-texto transition-colors hover:border-marca hover:bg-marca-suave/40"
                    >
                      {op}
                      <ArrowRight size={15} className="shrink-0 text-texto-suave" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Passo final */}
          {ehFinal && (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-marca-suave text-marca">
                <Check size={28} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-medium italic text-texto">
                Perfeito, {r.nome.split(" ")[0] || "tudo certo"}!
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-texto-suave">
                Já entendi seu cenário. Vamos continuar no WhatsApp para montar seu
                diagnóstico. Suas respostas já vão com você.
              </p>
              <div className="mt-4 space-y-1 rounded-lg bg-fundo p-3 text-left text-xs text-texto-suave">
                <div><b className="text-texto">Negócio:</b> {r.negocio}</div>
                <div><b className="text-texto">Faturamento:</b> {r.faturamento}</div>
                <div><b className="text-texto">Dificuldade:</b> {r.dificuldade}</div>
              </div>
              <button
                onClick={irWhatsApp}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-marca py-3.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01]"
              >
                Continuar no WhatsApp <ArrowRight size={16} />
              </button>
              <p className="mt-2 text-[11px] text-texto-suave">
                Vagas limitadas por região. Análise da diretoria.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
