"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check } from "lucide-react";
import { salvarInstagramCfg } from "@/lib/admin/actions";
import type { InstagramCfg } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function InstagramForm({ tenantId, cfg }: { tenantId: string; cfg: InstagramCfg }) {
  const router = useRouter();
  const [igAccountId, setIgAccountId] = useState(cfg.igAccountId);
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
      await salvarInstagramCfg(tenantId, { igAccountId, accessToken });
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
        <Camera size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Conexão Instagram</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Requer um App da Meta (conta IG Business + Página). Cole o ID da conta e o token da Página.
        A IA responde as DMs com a mesma persona e base de conhecimento.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">ID da conta IG Business</span>
          <input
            value={igAccountId}
            onChange={(e) => setIgAccountId(e.target.value)}
            placeholder="ex.: 17841400000000000"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            Token da Página{" "}
            {cfg.tokenSet && <span className="text-xs font-normal text-marca">(já configurado)</span>}
          </span>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={cfg.tokenSet ? "•••••••• deixe vazio para manter" : "cole o token da Página"}
            className={inputCls}
          />
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
