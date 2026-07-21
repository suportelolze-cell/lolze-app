"use client";

import { useState } from "react";
import { FlaskConical, Loader2, Play, Send } from "lucide-react";
import { testarAgente } from "@/lib/admin/actions";
import { BATERIA_PADRAO } from "@/lib/agent/sdr/simular";

type Resultado = {
  rotulo: string;
  pergunta: string;
  resposta: string;
  acoes: string[];
  erro?: string;
};

/**
 * Bateria de testes do agente (implantação): roda o cérebro REAL do cliente
 * em modo simulação — nada é gravado, nenhum canal recebe mensagem.
 */
export function TesteAgenteCard({ tenantId }: { tenantId: string }) {
  const [pergunta, setPergunta] = useState("");
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);

  async function rodarUma(rotulo: string, p: string) {
    const r = await testarAgente(tenantId, p);
    setResultados((prev) => [
      ...prev,
      { rotulo, pergunta: p, resposta: r.resposta, acoes: r.acoes, erro: r.erro },
    ]);
  }

  async function perguntaLivre(e: React.FormEvent) {
    e.preventDefault();
    if (!pergunta.trim() || rodando) return;
    setRodando(true);
    setProgresso("Perguntando ao agente…");
    try {
      await rodarUma("Pergunta livre", pergunta.trim());
      setPergunta("");
    } finally {
      setRodando(false);
      setProgresso("");
    }
  }

  async function bateriaCompleta() {
    if (rodando) return;
    setRodando(true);
    setResultados([]);
    try {
      for (let i = 0; i < BATERIA_PADRAO.length; i++) {
        const t = BATERIA_PADRAO[i];
        setProgresso(`${i + 1}/${BATERIA_PADRAO.length} — ${t.rotulo}…`);
        await rodarUma(t.rotulo, t.pergunta);
      }
    } finally {
      setRodando(false);
      setProgresso("");
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Testar o agente (simulação)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Roda a persona + base de conhecimento + agenda REAIS deste cliente, sem gravar nada e sem
        enviar mensagem em canal nenhum. Use antes do go-live e após mudanças na persona/base.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={bateriaCompleta}
          disabled={rodando}
          className="flex items-center gap-2 rounded-sm bg-marca px-5 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {rodando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          Rodar bateria padrão ({BATERIA_PADRAO.length} testes)
        </button>
        {progresso && <span className="text-xs font-medium text-texto-suave">{progresso}</span>}
      </div>

      <form onSubmit={perguntaLivre} className="mt-3 flex gap-2">
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ou faça uma pergunta específica como se fosse o lead…"
          className="w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca"
        />
        <button
          type="submit"
          disabled={rodando || !pergunta.trim()}
          className="flex items-center gap-1.5 rounded-sm border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo disabled:opacity-50"
        >
          <Send size={14} /> Testar
        </button>
      </form>

      {resultados.length > 0 && (
        <ul className="mt-5 space-y-3">
          {resultados.map((r, i) => (
            <li key={i} className="rounded-lg border border-borda bg-fundo p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
                {r.rotulo}
              </p>
              <p className="mt-1 text-sm text-texto-suave">
                <span className="font-semibold text-texto">Lead:</span> {r.pergunta}
              </p>
              {r.erro ? (
                <p className="mt-2 text-sm font-medium text-red-600">Erro: {r.erro}</p>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-texto">
                    <span className="font-semibold">IA:</span> {r.resposta || "(sem resposta)"}
                  </p>
                  {r.acoes.length > 0 && (
                    <p className="mt-2 text-xs text-texto-suave">
                      Ações internas: {r.acoes.join(" · ")}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
