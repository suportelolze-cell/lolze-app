// Esqueleto instantâneo das Configurações (menu de abas + painel).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 animate-pulse rounded bg-cinza-200" />
          <div className="h-4 w-80 animate-pulse rounded bg-cinza-200/70" />
        </div>
        <div className="h-10 w-52 animate-pulse rounded-sm bg-cinza-200" />
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex shrink-0 gap-1 md:w-60 md:flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-md bg-cinza-200/80" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4 rounded-xl border border-borda bg-superficie p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-cinza-200" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-cinza-200/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
