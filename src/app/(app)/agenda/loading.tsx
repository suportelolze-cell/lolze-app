// Esqueleto instantâneo da Agenda (barra de controle + grade).
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-48 animate-pulse rounded bg-cinza-200" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-cinza-200" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md border border-borda bg-superficie" />
        ))}
      </div>
    </div>
  );
}
