import type { LucideIcon } from "lucide-react";

export function MetricCard({
  titulo,
  valor,
  microcopy,
  icon: Icon,
  selo,
  destaque,
}: {
  titulo: string;
  valor: string;
  microcopy: string;
  icon: LucideIcon;
  selo?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-superficie p-5 ${
        destaque ? "border-marca/30" : "border-borda"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-texto-suave">{titulo}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${
            destaque ? "bg-marca-suave text-marca" : "bg-fundo text-texto-suave"
          }`}
        >
          <Icon size={16} />
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-corpo text-3xl font-bold tracking-tight text-texto">
          {valor}
        </span>
        {selo && (
          <span className="rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca">
            {selo}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-texto-suave">{microcopy}</p>
    </div>
  );
}
