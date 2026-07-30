// Esqueleto instantâneo do Pipeline (colunas do kanban) — casa com a tela real.
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100vh-8rem)]">
      <div className="mb-5 space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-cinza-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-cinza-200/70" />
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <div className="h-6 w-32 animate-pulse rounded bg-cinza-200" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="h-24 animate-pulse rounded-lg border border-borda bg-superficie"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
