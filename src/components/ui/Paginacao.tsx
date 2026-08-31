"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "./Button";

/**
 * Paginação no cliente para listas já filtradas. A tela continua fazendo o
 * filtro/busca sobre o conjunto todo (rápido), mas só RENDERIZA uma página de
 * cada vez — o que tira o custo de desenhar milhares de linhas de uma vez.
 *
 * `resetKey` deve conter o estado dos filtros (ex.: `${busca}|${situacao}`);
 * quando ele muda, a paginação volta para a página 1.
 */
export function usePaginado<T>(itens: T[], porPagina = 25, resetKey = "") {
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setPagina(1);
  }, [resetKey]);

  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const p = Math.min(pagina, totalPaginas);
  const inicio = (p - 1) * porPagina;

  const visiveis = useMemo(() => itens.slice(inicio, inicio + porPagina), [itens, inicio, porPagina]);

  return {
    visiveis,
    pagina: p,
    setPagina,
    totalPaginas,
    inicio,
    fim: Math.min(inicio + porPagina, itens.length),
    total: itens.length,
  };
}

export function Paginacao({
  pagina,
  totalPaginas,
  inicio,
  fim,
  total,
  onPagina,
  rotulo = "itens",
}: {
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fim: number;
  total: number;
  onPagina: (p: number) => void;
  rotulo?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-texto-suave">
      <span>
        {total === 0 ? `Nenhum ${rotulo.replace(/s$/, "")}` : `Mostrando ${inicio + 1}–${fim} de ${total} ${rotulo}`}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina <= 1}
            className={buttonClasses("secondary", "sm", "px-2.5")}
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="tabular-nums">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => onPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
            className={buttonClasses("secondary", "sm", "px-2.5")}
            aria-label="Próxima página"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
