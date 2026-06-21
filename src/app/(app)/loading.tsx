// Mostrado instantaneamente ao navegar, enquanto a página busca os dados.
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Cabeçalho */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-72 rounded-md bg-cinza-200" />
          <div className="h-4 w-96 rounded bg-cinza-200/70" />
        </div>
        <div className="h-10 w-44 rounded-sm bg-cinza-200" />
      </div>

      {/* Linha de cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-borda bg-superficie" />
        ))}
      </div>

      {/* Bloco principal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-lg border border-borda bg-superficie lg:col-span-2" />
        <div className="h-80 rounded-lg border border-borda bg-superficie" />
      </div>
    </div>
  );
}
