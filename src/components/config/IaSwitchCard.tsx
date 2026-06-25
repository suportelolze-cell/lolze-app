"use client";

import { useState } from "react";
import { Bot, Power, Loader2 } from "lucide-react";
import { setIaAtiva } from "@/lib/supabase/crm-actions";

/**
 * Master switch da IA. Quando desligada, o agente não responde NENHUM cliente
 * (o SDR respeita app_config.agente_ativo). Ligar volta tudo ao normal.
 */
export function IaSwitchCard({ inicial }: { inicial: boolean }) {
  const [ativa, setAtiva] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function alternar() {
    const novo = !ativa;
    setSalvando(true);
    setErro("");
    setAtiva(novo); // otimista
    const r = await setIaAtiva(novo).catch(() => ({ ok: false, erro: "Falha de conexão." }));
    setSalvando(false);
    if (!r.ok) {
      setAtiva(!novo); // desfaz
      setErro(r.erro ?? "Não foi possível salvar.");
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        ativa ? "border-marca/40 bg-marca-suave/30" : "border-red-300 bg-red-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              ativa ? "bg-marca text-bege-principal" : "bg-red-500 text-white"
            }`}
          >
            <Bot size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-texto">Inteligência Artificial</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  ativa ? "bg-marca-suave text-marca" : "bg-red-100 text-red-600"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${ativa ? "bg-marca" : "bg-red-500"}`} />
                {ativa ? "Ligada" : "Desligada"}
              </span>
            </div>
            <p className="mt-1 max-w-md text-xs text-texto-suave">
              {ativa
                ? "A IA está atendendo e respondendo seus clientes automaticamente."
                : "A IA está PARADA — não responde nenhum cliente. As mensagens continuam chegando para a equipe atender manualmente."}
            </p>
            {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
          </div>
        </div>

        <button
          onClick={alternar}
          disabled={salvando}
          className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
            ativa
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-marca text-bege-principal hover:scale-[1.02]"
          }`}
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
          {salvando ? "Aplicando…" : ativa ? "Desligar IA" : "Ligar IA"}
        </button>
      </div>
    </div>
  );
}

/**
 * Versão compacta (pílula) do master switch — para o cabeçalho do Atendimento.
 * Mesma ação do card; mostra o estado e alterna num clique.
 */
export function IaSwitchPill({ inicial }: { inicial: boolean }) {
  const [ativa, setAtiva] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    const novo = !ativa;
    setSalvando(true);
    setAtiva(novo); // otimista
    const r = await setIaAtiva(novo).catch(() => ({ ok: false }));
    setSalvando(false);
    if (!r.ok) setAtiva(!novo); // desfaz
  }

  return (
    <button
      onClick={alternar}
      disabled={salvando}
      title={ativa ? "IA ligada — clique para desligar" : "IA desligada — clique para ligar"}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
        ativa
          ? "border-marca/40 bg-marca-suave text-marca hover:bg-marca-suave/70"
          : "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
      }`}
    >
      {salvando ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
      IA {ativa ? "Ligada" : "Desligada"}
      <span
        className={`ml-0.5 inline-flex h-3.5 w-6 items-center rounded-full px-0.5 transition-colors ${
          ativa ? "justify-end bg-marca" : "justify-start bg-red-300"
        }`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </span>
    </button>
  );
}
