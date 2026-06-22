import { Megaphone, Sprout, TrendingUp } from "lucide-react";

type Anuncio = { anuncio: string; leads: number };

/**
 * Origem dos leads: tráfego pago (clicaram num anúncio Click-to-WhatsApp)
 * vs orgânico (chegaram sozinhos). Classificação automática na entrada.
 */
export function OrigemLeads({
  pagos,
  organicos,
  topAnuncios = [],
}: {
  pagos: number;
  organicos: number;
  topAnuncios?: Anuncio[];
}) {
  const total = pagos + organicos;
  const pctPago = total > 0 ? Math.round((pagos / total) * 100) : 0;
  const pctOrg = 100 - pctPago;

  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <h2 className="font-corpo text-sm font-bold text-texto">Origem dos Leads</h2>
      <p className="mb-4 mt-0.5 text-xs text-texto-suave">
        De onde vieram seus contatos — anúncio pago ou orgânico.
      </p>

      {/* Barra proporcional */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-fundo">
        <div className="bg-marca" style={{ width: `${pctPago}%` }} />
        <div className="bg-amber-400" style={{ width: `${pctOrg}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-borda bg-fundo px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-marca">
            <Megaphone size={15} />
            <span className="text-xs font-semibold text-texto">Tráfego pago</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-texto">{pagos}</p>
          <p className="text-xs text-texto-suave">{pctPago}% • via anúncio</p>
        </div>
        <div className="rounded-md border border-borda bg-fundo px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-amber-600">
            <Sprout size={15} />
            <span className="text-xs font-semibold text-texto">Orgânico</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-texto">{organicos}</p>
          <p className="text-xs text-texto-suave">{pctOrg}% • sem anúncio</p>
        </div>
      </div>

      {/* Ranking de anúncios que mais trazem leads */}
      {topAnuncios.length > 0 && (
        <div className="mt-4 border-t border-borda pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-texto-suave">
            <TrendingUp size={14} />
            <span className="text-xs font-semibold">Anúncios que mais trazem clientes</span>
          </div>
          <ul className="space-y-1.5">
            {topAnuncios.map((a) => (
              <li key={a.anuncio} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-texto" title={a.anuncio}>
                  {a.anuncio}
                </span>
                <span className="shrink-0 rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">
                  {a.leads} {a.leads === 1 ? "lead" : "leads"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
