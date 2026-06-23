"use client";

import { Search } from "lucide-react";
import type { Conversa } from "@/lib/conversas";

export type Filtro = "quentes" | "ia" | "comigo" | "todas";

/** Selo visual do canal de origem da conversa. */
function canalSelo(canal: string): { rotulo: string; classe: string } {
  switch (canal) {
    case "instagram":
      return { rotulo: "📷 Instagram", classe: "bg-pink-100 text-pink-700" };
    case "facebook":
      return { rotulo: "f Facebook", classe: "bg-blue-100 text-blue-700" };
    case "telegram":
      return { rotulo: "✈️ Telegram", classe: "bg-sky-100 text-sky-700" };
    default:
      return { rotulo: "🟢 WhatsApp", classe: "bg-marca-suave text-marca" };
  }
}

const filtros: { id: Filtro; rotulo: string }[] = [
  { id: "quentes", rotulo: "🔥 Quentes" },
  { id: "ia", rotulo: "🤖 Com a IA" },
  { id: "comigo", rotulo: "👤 Comigo" },
  { id: "todas", rotulo: "Todas" },
];

export function ConversaList({
  conversas,
  selecionadaId,
  onSelect,
  busca,
  setBusca,
  filtro,
  setFiltro,
  currentUserId = "",
}: {
  conversas: Conversa[];
  selecionadaId: number | null;
  onSelect: (id: number) => void;
  busca: string;
  setBusca: (v: string) => void;
  filtro: Filtro;
  setFiltro: (f: Filtro) => void;
  currentUserId?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col border-r border-borda bg-superficie">
      {/* Busca */}
      <div className="border-b border-borda p-3">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa por nome ou número..."
            className="w-full rounded-md border border-borda bg-fundo py-2 pl-9 pr-3 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca"
          />
        </div>
        {/* Filtros */}
        <div className="mt-2 flex gap-1">
          {filtros.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                filtro === f.id
                  ? "bg-marca text-bege-principal"
                  : "bg-fundo text-texto-suave hover:text-texto"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {conversas.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs italic text-texto-suave">
            Nenhuma conversa neste filtro.
          </p>
        ) : (
          conversas.map((c) => {
            const ativa = c.id === selecionadaId;
            const ultima = c.mensagens[c.mensagens.length - 1];
            const minha = c.atendenteId === currentUserId;
            const outroAtende = c.atendenteId !== null && !minha;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`flex w-full gap-3 border-b border-borda px-3 py-3 text-left transition-colors ${
                  ativa ? "bg-marca-suave/40" : "hover:bg-fundo"
                } ${c.precisaHumano ? "border-l-2 border-l-amber-500" : ""}`}
              >
                {/* Avatar */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-escuro-quente text-sm font-bold text-bege-principal">
                  {c.nome.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-texto">
                      {c.nome}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${canalSelo(c.canal).classe}`}
                      >
                        {canalSelo(c.canal).rotulo}
                      </span>
                      {c.temperatura === "quente" && <span className="text-xs">🔥</span>}
                    </span>
                  </div>
                  <p className="truncate text-xs text-texto-suave">
                    {ultima?.autor === "lead" ? "" : "Você: "}
                    {ultima?.texto}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        c.comando === "ia"
                          ? "bg-fundo text-texto-suave"
                          : outroAtende
                          ? "bg-amber-100 text-amber-700"
                          : "bg-marca-suave text-marca"
                      }`}
                    >
                      {c.comando === "ia"
                        ? "🤖 IA respondendo"
                        : outroAtende
                        ? `🔒 ${c.atendenteNome}`
                        : "👤 Você assumiu"}
                    </span>
                    {c.precisaHumano && (
                      <span className="text-[10px] font-semibold text-amber-600">
                        ⚠️ pede reforço
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
