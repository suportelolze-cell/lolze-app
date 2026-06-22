"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Loader2, Check } from "lucide-react";
import { salvarMetaAdsCfg } from "@/lib/admin/actions";
import type { MetaAdsCfg } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function MetaAdsForm({ tenantId, cfg }: { tenantId: string; cfg: MetaAdsCfg }) {
  const router = useRouter();
  const [adAccountId, setAdAccountId] = useState(cfg.adAccountId);
  const [accessToken, setAccessToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await salvarMetaAdsCfg(tenantId, { adAccountId, accessToken });
      setAccessToken("");
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
        <Megaphone size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Conexão Meta Ads</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Conecte a conta de anúncios do cliente para, em breve, sincronizar o gasto e o custo por
        lead por anúncio. A classificação pago × orgânico já funciona sem isso.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            ID da conta de anúncios (Ad Account ID)
          </span>
          <input
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value)}
            placeholder="act_1234567890"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            Token de acesso{" "}
            {cfg.tokenSet && <span className="text-xs font-normal text-marca">(já configurado)</span>}
          </span>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={cfg.tokenSet ? "•••••••• deixe vazio para manter" : "cole o token do Meta"}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-texto-suave">
            Guardado de forma segura (visível só para o admin). Necessário a permissão de leitura de
            anúncios na conta do cliente.
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
