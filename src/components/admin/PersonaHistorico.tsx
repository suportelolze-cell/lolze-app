"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, Undo2 } from "lucide-react";
import { reverterPersona, type VersaoPersona } from "@/lib/admin/actions";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function PersonaHistorico({
  tenantId,
  versoes,
}: {
  tenantId: string;
  versoes: VersaoPersona[];
}) {
  const router = useRouter();
  const [revertendo, setRevertendo] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function reverter(id: number) {
    if (
      !window.confirm(
        "Restaurar esta versão da persona? A versão atual é salva no histórico antes — então dá para voltar atrás depois."
      )
    )
      return;
    setRevertendo(id);
    setErro("");
    const r = await reverterPersona(tenantId, id);
    setRevertendo(null);
    if (r.ok) router.refresh();
    else setErro(r.erro ?? "Não foi possível restaurar.");
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <h2 className="mb-1 flex items-center gap-2 font-corpo text-lg font-bold text-texto">
        <History size={18} className="text-marca" /> Histórico da persona
      </h2>
      <p className="mb-4 text-sm text-texto-suave">
        Cada vez que a persona é salva, a versão anterior fica guardada aqui — dá para
        restaurar qualquer uma (a versão atual é salva antes, então nada se perde).
      </p>

      {versoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda bg-fundo px-4 py-6 text-center text-sm text-texto-suave">
          Nenhuma versão anterior ainda. O histórico começa a partir da próxima vez que você
          salvar a persona.
        </p>
      ) : (
        <ul className="space-y-2">
          {versoes.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-fundo px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs text-texto-suave">
                  <span className="font-semibold text-texto">{quando(v.quando)}</span>
                  {v.quem && <span>· {v.quem}</span>}
                  {v.origem === "rollback" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <Undo2 size={10} /> restauração
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-sm text-texto">{v.preview}</p>
              </div>
              <button
                onClick={() => reverter(v.id)}
                disabled={revertendo !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-borda px-3 py-1.5 text-xs font-semibold text-texto transition-colors hover:border-marca hover:text-marca disabled:opacity-50"
              >
                <RotateCcw size={13} /> {revertendo === v.id ? "Restaurando…" : "Restaurar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
    </div>
  );
}
