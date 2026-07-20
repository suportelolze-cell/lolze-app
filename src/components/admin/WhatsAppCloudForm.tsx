"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2, Check } from "lucide-react";
import { salvarWaCloudCfg } from "@/lib/admin/actions";
import type { WaCloudCfg } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

/**
 * Conexão do WhatsApp OFICIAL (Cloud API da Meta) por cliente.
 * Quando preenchida, o envio passa a usar a API oficial (com recibos de
 * entrega/leitura); sem ela, o cliente continua na Evolution (QR).
 */
export function WhatsAppCloudForm({ tenantId, cfg }: { tenantId: string; cfg: WaCloudCfg }) {
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState(cfg.phoneNumberId);
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
      await salvarWaCloudCfg(tenantId, { phoneNumberId, accessToken });
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
        <MessageCircle size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">WhatsApp oficial (Cloud API)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Número aprovado na Cloud API da Meta. Preenchido, o envio migra para a API oficial
        (com recibos de entrega/leitura). Vazio, o cliente segue na conexão por QR (Evolution).
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">Phone Number ID</span>
          <input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="ex.: 123456789012345 (Meta → WhatsApp → Configuração da API)"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-texto">
            Access Token{" "}
            {cfg.tokenSet && <span className="text-xs font-normal text-marca">(já configurado)</span>}
          </span>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={cfg.tokenSet ? "•••••••• deixe vazio para manter" : "token permanente (System User)"}
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
