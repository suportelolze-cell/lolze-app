"use client";

import { useMemo, useState } from "react";
import { Search, X, Play, Check, GraduationCap, FileText, MessageCircle } from "lucide-react";
import { VIDEOS, FAQS, type Video } from "@/lib/cursos";
import { VideoCard } from "./VideoCard";

export function Universidade() {
  const [assistidos, setAssistidos] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<Video | null>(null);
  const [busca, setBusca] = useState("");

  const progresso = Math.round((assistidos.size / VIDEOS.length) * 100);
  const fast = VIDEOS.filter((v) => v.trilha === "fast");
  const equipe = VIDEOS.filter((v) => v.trilha === "equipe");

  const faqsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) => f.toLowerCase().includes(q));
  }, [busca]);

  function marcarAssistido(id: string) {
    setAssistidos((prev) => new Set(prev).add(id));
    setAberto(null);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho + progresso */}
      <header>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-medium italic tracking-tight text-texto">
              <GraduationCap size={26} className="text-marca" /> Universidade Lolze
            </h1>
            <p className="mt-1 text-texto-suave">
              Domine a sua máquina de vendas. Assista aos guias rápidos e coloque
              sua equipe para faturar.
            </p>
          </div>
          <div className="w-56">
            <div className="mb-1 flex justify-between text-xs font-semibold text-texto-suave">
              <span>Seu domínio da plataforma</span>
              <span className="text-marca">{progresso}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-cinza-200">
              <div
                className="h-full rounded-full bg-marca transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Trilha 1: Fast-Track */}
      <Trilha
        titulo="🚀 Comece por Aqui (Obrigatório)"
        micro="Tudo o que você precisa saber em menos de 15 minutos para ver o dinheiro entrar."
        videos={fast}
        assistidos={assistidos}
        onAbrir={setAberto}
      />

      {/* Trilha 2: Linha de Frente */}
      <Trilha
        titulo="🎯 Treinamento para sua Equipe Comercial"
        micro="Envie estes módulos para seus vendedores ou secretárias. O foco aqui é pura conversão."
        videos={equipe}
        assistidos={assistidos}
        onAbrir={setAberto}
      />

      {/* Central de Ajuda */}
      <section className="rounded-lg border border-borda bg-superficie p-6">
        <h2 className="font-corpo text-lg font-bold text-texto">Dúvidas Rápidas?</h2>
        <div className="relative mt-3 max-w-xl">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite sua dúvida (Ex: Como integro meu Google Calendar?)"
            className="w-full rounded-md border border-borda bg-fundo py-2.5 pl-9 pr-3 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {faqsFiltrados.length === 0 ? (
            <p className="text-sm italic text-texto-suave">
              Nenhum artigo encontrado. Fale com o suporte abaixo.
            </p>
          ) : (
            faqsFiltrados.map((f) => (
              <button
                key={f}
                className="flex items-center gap-2 rounded-md border border-borda px-3 py-2 text-sm text-texto transition-colors hover:bg-fundo"
              >
                <FileText size={14} className="text-texto-suave" /> {f}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Player (modal) */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-escuro-quente/50 p-4"
          onClick={() => setAberto(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-lg bg-superficie shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Player placeholder */}
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-escuro-quente to-[#2a2520]">
              <span className="text-6xl">{aberto.icone}</span>
              <span className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-marca/90 text-bege-principal">
                <Play size={26} fill="currentColor" />
              </span>
              <button
                onClick={() => setAberto(null)}
                className="absolute right-3 top-3 rounded-md bg-escuro-quente/60 p-1.5 text-bege-principal hover:bg-escuro-quente"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <h3 className="text-lg font-bold text-texto">{aberto.titulo}</h3>
                <p className="mt-1 text-sm text-texto-suave">{aberto.descricao}</p>
              </div>
              <button
                onClick={() => marcarAssistido(aberto.id)}
                disabled={assistidos.has(aberto.id)}
                className="flex shrink-0 items-center gap-2 rounded-md bg-marca px-4 py-2 text-sm font-semibold text-bege-principal disabled:opacity-50"
              >
                <Check size={16} />
                {assistidos.has(aberto.id) ? "Concluído" : "Marcar como assistido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão de pânico flutuante (suporte) */}
      <button className="fixed bottom-24 right-6 z-30 flex items-center gap-2 rounded-full bg-marca px-5 py-3 text-sm font-semibold text-bege-principal shadow-lg transition-transform hover:scale-105">
        <MessageCircle size={18} /> Falar com Suporte
      </button>
    </div>
  );
}

function Trilha({
  titulo,
  micro,
  videos,
  assistidos,
  onAbrir,
}: {
  titulo: string;
  micro: string;
  videos: Video[];
  assistidos: Set<string>;
  onAbrir: (v: Video) => void;
}) {
  return (
    <section>
      <h2 className="font-corpo text-lg font-bold text-texto">{titulo}</h2>
      <p className="mb-4 mt-1 text-sm text-texto-suave">{micro}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            assistido={assistidos.has(v.id)}
            onClick={() => onAbrir(v)}
          />
        ))}
      </div>
    </section>
  );
}
