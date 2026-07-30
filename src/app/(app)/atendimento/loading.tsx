// Esqueleto instantâneo da Central de Atendimento (lista + chat + painel).
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col lg:h-[calc(100vh-7rem)]">
      <div className="mb-4 h-7 w-64 animate-pulse rounded bg-cinza-200" />
      <div className="flex flex-1 overflow-hidden rounded-lg border border-borda">
        {/* Lista de conversas */}
        <div className="hidden w-80 shrink-0 space-y-3 border-r border-borda bg-superficie p-3 lg:block">
          <div className="h-9 w-full animate-pulse rounded-md bg-cinza-200" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-cinza-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-cinza-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-cinza-200/70" />
              </div>
            </div>
          ))}
        </div>
        {/* Chat */}
        <div className="flex-1 animate-pulse bg-fundo" />
        {/* Raio-X */}
        <div className="hidden w-80 shrink-0 border-l border-borda bg-superficie xl:block" />
      </div>
    </div>
  );
}
