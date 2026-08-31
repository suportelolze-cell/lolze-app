"use client";

import { useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AplicarButton } from "./AplicarButton";
import { registrarDiagnosticoLanding } from "@/lib/landing/funil-actions";

/**
 * Diagnóstico Rápido — calculadora de perda mensal.
 * Tudo no navegador (sem API, sem custo). O visitante mexe nos 3 controles e
 * vê, ao vivo, quanto pode estar perdendo — quantificando a própria dor.
 *
 * Modelo com PREMISSAS EXPLÍCITAS e três cenários (conservador/base/otimista),
 * em vez de um número único — dos leads que chegam fora do horário, uma fração é
 * recuperável com atendimento imediato; desses, uma fração vira venda ao ticket
 * informado. É estimativa, não garantia.
 */
const DIAS = 30;
const CENARIOS = {
  conservador: { rec: 0.4, conv: 0.1 },
  base: { rec: 0.6, conv: 0.15 },
  otimista: { rec: 0.7, conv: 0.2 },
};

function Linha({
  label,
  valor,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  valor: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm text-texto-suave">
          {label}
        </label>
        <span className="font-corpo text-lg font-bold text-texto">{valor}</span>
      </div>
      <input
        id={id}
        aria-valuetext={valor}
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={Number(valor.replace(/\D/g, "")) || min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full cursor-pointer accent-escuro-quente"
      />
    </div>
  );
}

export function Diagnostico() {
  const [leadsDia, setLeadsDia] = useState(20);
  const [foraPct, setForaPct] = useState(40);
  const [ticket, setTicket] = useState(500);

  // Funil da Lolze: registra a 1ª interação com a calculadora (1x por sessão).
  const registrou = useRef(false);
  function marcarInteracao() {
    if (registrou.current) return;
    registrou.current = true;
    try {
      if (sessionStorage.getItem("lz_diag")) return;
      sessionStorage.setItem("lz_diag", "1");
    } catch {
      /* sessionStorage indisponível: segue só com o guard em memória */
    }
    void registrarDiagnosticoLanding().catch(() => {});
  }

  const foraMes = leadsDia * DIAS * (foraPct / 100);
  const perdaCenario = (c: { rec: number; conv: number }) =>
    Math.round((foraMes * c.rec * c.conv * ticket) / 100) * 100;
  const perda = perdaCenario(CENARIOS.base);
  const perdaConserv = perdaCenario(CENARIOS.conservador);
  const perdaOtim = perdaCenario(CENARIOS.otimista);
  const escapando = Math.round(foraMes * CENARIOS.base.rec);
  const brl = (n: number) => n.toLocaleString("pt-BR");

  return (
    <section id="diagnostico" className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-suave/70">
            Diagnóstico rápido
          </p>
          <h2 className="mt-3 font-corpo text-3xl font-semibold leading-tight text-texto sm:text-4xl">
            Quanto você pode estar
            <br className="hidden sm:block" /> perdendo todo mês?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-texto-suave">
            Responda 3 perguntas e veja a estimativa baseada nos seus números.
          </p>
        </div>

        <div className="mt-10 space-y-7">
          <Linha
            label="Quantos leads você recebe por dia?"
            valor={String(leadsDia)}
            min={1}
            max={100}
            step={1}
            onChange={(v) => { marcarInteracao(); setLeadsDia(v); }}
          />
          <Linha
            label="% de leads que chegam fora do horário comercial"
            valor={`${foraPct}%`}
            min={0}
            max={100}
            step={5}
            onChange={(v) => { marcarInteracao(); setForaPct(v); }}
          />
          <Linha
            label="Ticket médio do seu serviço (R$)"
            valor={`R$ ${brl(ticket)}`}
            min={50}
            max={5000}
            step={50}
            onChange={(v) => { marcarInteracao(); setTicket(v); }}
          />
        </div>

        {/* Card de resultado */}
        <div className="mt-10 rounded-3xl bg-escuro-quente px-8 py-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bege-principal/55">
            Estimativa de perda · cenário base
          </p>
          <div className="mt-3 font-corpo text-5xl font-bold text-bege-principal sm:text-6xl">
            ≈ R$ {brl(perda)} <span className="text-3xl font-medium sm:text-4xl">/ mês</span>
          </div>
          <p className="mt-2 text-sm font-medium text-bege-principal/70">
            Faixa: R$ {brl(perdaConserv)} a R$ {brl(perdaOtim)} / mês
            <span className="text-bege-principal/50"> (conservador → otimista)</span>
          </p>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-bege-principal/70">
            <span className="font-bold text-bege-principal">{escapando} leads</span> podem estar
            escapando da sua agenda todo mês.{" "}
            <span className="font-semibold text-bege-principal">Atendimento automatizado</span>{" "}
            existe justamente para recuperar essa janela.
          </p>
          <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-bege-principal/45">
            Premissas: dos leads fora do horário, 40-70% seriam recuperáveis com atendimento
            imediato; desses, 10-20% viram venda ao ticket informado. É uma estimativa para
            dimensionar a dor, não uma garantia de resultado.
          </p>
          <AplicarButton className="mt-8 inline-flex items-center gap-2 rounded-full bg-bege-principal px-7 py-3.5 text-base font-bold text-escuro-quente transition-transform hover:scale-[1.03]">
            Quero parar de perder dinheiro <ArrowRight size={18} />
          </AplicarButton>
        </div>
      </div>
    </section>
  );
}
