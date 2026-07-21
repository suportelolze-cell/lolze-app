import { CheckCircle2, Circle, Rocket } from "lucide-react";
import type { Prontidao } from "@/lib/admin/prontidao";

/**
 * Checklist de prontidão para o go-live — computado dos dados reais do tenant
 * (nada de marcar na mão). Server component: recebe o resultado pronto.
 */
export function ProntidaoGoLive({ prontidao }: { prontidao: Prontidao }) {
  const { itens, prontos, total } = prontidao;
  const completo = prontos === total;
  const pct = Math.round((prontos / total) * 100);

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-marca" />
          <h2 className="font-corpo text-lg font-bold text-texto">Prontidão para o go-live</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            completo ? "bg-marca-suave text-marca" : "bg-fundo text-texto-suave"
          }`}
        >
          {prontos}/{total}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-fundo">
        <div
          className="h-full rounded-full bg-marca transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {completo && (
        <p className="mt-2 text-sm font-semibold text-marca">
          Implantação completa — cliente pronto para operação. 🚀
        </p>
      )}

      <ul className="mt-4 space-y-2.5">
        {itens.map((i) => (
          <li key={i.chave} className="flex items-start gap-2.5">
            {i.ok ? (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-marca" />
            ) : (
              <Circle size={17} className="mt-0.5 shrink-0 text-texto-suave/50" />
            )}
            <div>
              <p className={`text-sm font-semibold ${i.ok ? "text-texto" : "text-texto-suave"}`}>
                {i.rotulo}
              </p>
              {!i.ok && <p className="text-xs text-texto-suave">{i.dica}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
