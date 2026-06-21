"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const ITENS: { q: string; a: string }[] = [
  {
    q: "1. Você investe em tráfego pago de forma séria?",
    a: "A Lolze é um multiplicador de resultados. Se você já tem fluxo de leads chegando, nós vamos garantir que nenhum deles esfrie ou seja perdido por lentidão.",
  },
  {
    q: "2. Você tem um serviço validado e de alto valor?",
    a: "Nosso ecossistema foi desenhado para negócios onde cada agendamento perdido representa milhares de reais deixados na mesa (Clínicas, Advocacia, Serviços Premium).",
  },
  {
    q: "3. Você tem capacidade para atender mais clientes?",
    a: "A automação vai acelerar a entrada de clientes quentes. Sua equipe de especialistas precisa ter agenda e estrutura para entregar o serviço quando a demanda escalar.",
  },
];

export function FAQ() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-superficie px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
            Filtro de qualificação
          </p>
          <h2 className="font-display text-3xl font-medium italic text-texto sm:text-4xl">
            Esta infraestrutura não é para qualquer empresa.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-texto-suave">
            Nós construímos máquinas de escala apenas para quem já possui tração.
            Veja se você tem o perfil exigido:
          </p>
        </div>

        <div className="divide-y divide-borda border-y border-borda">
          {ITENS.map((item, i) => {
            const open = aberto === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setAberto(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-semibold text-texto">{item.q}</span>
                  <span className="shrink-0 text-marca">
                    {open ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
                {open && (
                  <p className="-mt-1 pb-5 pr-8 text-sm leading-relaxed text-texto-suave">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
