"use client";

import { Play, Check, Clock } from "lucide-react";
import type { Video } from "@/lib/cursos";

export function VideoCard({
  video,
  assistido,
  onClick,
}: {
  video: Video;
  assistido: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-lg border border-borda bg-superficie text-left transition-shadow hover:shadow-lg"
    >
      {/* Thumbnail */}
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-escuro-quente to-[#2a2520]">
        <span className="text-4xl">{video.icone}</span>

        {/* Overlay play */}
        <span className="absolute inset-0 flex items-center justify-center bg-escuro-quente/0 transition-colors group-hover:bg-escuro-quente/30">
          <span className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-marca text-bege-principal opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100">
            <Play size={18} fill="currentColor" />
          </span>
        </span>

        {/* Duração */}
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-escuro-quente/80 px-1.5 py-0.5 text-[10px] font-semibold text-bege-principal">
          <Clock size={10} /> {video.duracao} min
        </span>

        {/* Selo assistido */}
        {assistido && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-marca px-2 py-0.5 text-[10px] font-bold text-bege-principal">
            <Check size={11} /> Assistido
          </span>
        )}
      </div>

      {/* Texto */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-bold leading-snug text-texto">
          {video.titulo}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-texto-suave">
          {video.descricao}
        </p>
      </div>
    </button>
  );
}
