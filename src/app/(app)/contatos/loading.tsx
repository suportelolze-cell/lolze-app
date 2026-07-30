// Esqueleto instantâneo dos Contatos (barra + linhas de tabela).
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="h-7 w-40 animate-pulse rounded bg-cinza-200" />
        <div className="h-9 w-40 animate-pulse rounded-md bg-cinza-200" />
      </div>
      <div className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-cinza-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-48 animate-pulse rounded bg-cinza-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-cinza-200/70" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded bg-cinza-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
