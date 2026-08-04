"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Loader2, Check } from "lucide-react";
import { salvarGoogleAdsCfg } from "@/lib/admin/actions";
import type { GoogleAdsCfg } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function GoogleAdsForm({ tenantId, cfg }: { tenantId: string; cfg: GoogleAdsCfg }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(cfg.customerId);
  const [refreshToken, setRefreshToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await salvarGoogleAdsCfg(tenantId, { customerId, refreshToken });
      setRefreshToken("");
      setSalvo(true);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <LineChart size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Conexão Google Ads</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Conecte a conta de anúncios do cliente para sincronizar o gasto e os cliques diários — que
        aparecem no painel (Investimento e Custo por Agendamento) e no topo do Raio-X do Funil. Igual
        ao Meta, mas o Google usa um <b>refresh token</b> com escopo <code>adwords</code>.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            ID da conta (Customer ID)
          </span>
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="123-456-7890"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            Refresh token{" "}
            {cfg.refreshTokenSet && (
              <span className="text-xs font-normal text-marca">(já configurado)</span>
            )}
          </span>
          <input
            type="password"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder={cfg.refreshTokenSet ? "•••••••• deixe vazio para manter" : "cole o refresh token"}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-texto-suave">
            Gerado com o escopo de leitura de anúncios (<code>adwords</code>). Guardado de forma
            segura (visível só para o admin). Requer o developer token configurado no servidor.
          </p>
        </label>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar conexão
        </button>
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-marca">
            <Check size={16} /> Salvo
          </span>
        )}
      </div>
    </form>
  );
}
