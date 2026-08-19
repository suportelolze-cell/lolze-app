"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { Button, Badge, StatusDot } from "@/components/ui";
import {
  getIntegracoesCheckout,
  salvarIntegracaoCheckout,
  regenerarTokenCheckout,
} from "@/lib/checkout/config-actions";
import type { IntegracaoCheckoutView } from "@/lib/checkout/core";

type Plataforma = IntegracaoCheckoutView["plataforma"];

const META: Record<Plataforma, { label: string; segredo: string; onde: string }> = {
  hotmart: {
    label: "Hotmart",
    segredo: "hottok",
    onde: "Na Hotmart, em Ferramentas > Webhook (API e Notificações): cole a URL abaixo e copie o hottok para cá.",
  },
  ticto: {
    label: "Ticto",
    segredo: "token",
    onde: "Na Ticto, no Postback da oferta: cole a URL abaixo e defina/copie o token para cá.",
  },
  kiwify: {
    label: "Kiwify",
    segredo: "token de assinatura",
    onde: "Na Kiwify, em Apps > Webhooks: cole a URL abaixo e copie o token (segredo de assinatura) para cá.",
  },
};

export function CheckoutIntegracoes() {
  const [itens, setItens] = useState<IntegracaoCheckoutView[] | null>(null);
  const [erro, setErro] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function carregar() {
    const r = await getIntegracoesCheckout();
    if (!r.ok || !r.itens) {
      setErro(r.erro ?? "Não foi possível carregar.");
      setItens([]);
      return;
    }
    setItens(r.itens);
    setAtivos(Object.fromEntries(r.itens.map((i) => [i.plataforma, i.ativo])));
  }

  useEffect(() => {
    carregar();
  }, []);

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const urlDe = (i: IntegracaoCheckoutView) =>
    i.ingestToken ? `${origem}/api/checkout/${i.plataforma}?t=${i.ingestToken}` : "";

  async function salvar(p: Plataforma) {
    setSalvando(p);
    const r = await salvarIntegracaoCheckout({
      plataforma: p,
      secret: secrets[p] || undefined,
      ativo: ativos[p] ?? true,
    });
    setSalvando(null);
    if (!r.ok) {
      window.alert(r.erro ?? "Não foi possível salvar.");
      return;
    }
    setSecrets((s) => ({ ...s, [p]: "" }));
    await carregar();
  }

  async function regerar(p: Plataforma) {
    if (!window.confirm("Gerar um novo link? O link antigo para de funcionar e você terá que atualizar na plataforma.")) return;
    setSalvando(p);
    const r = await regenerarTokenCheckout(p);
    setSalvando(null);
    if (!r.ok) {
      window.alert(r.erro ?? "Não foi possível gerar.");
      return;
    }
    await carregar();
  }

  function copiar(p: Plataforma, url: string) {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopiado(p);
        setTimeout(() => setCopiado((c) => (c === p ? null : c)), 1500);
      },
      () => {}
    );
  }

  if (itens === null) {
    return (
      <p className="flex items-center gap-2 text-xs text-texto-suave">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </p>
    );
  }

  if (erro) {
    return <p className="text-xs text-texto-suave">{erro}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-texto-suave">
        Conecte suas plataformas de venda para que cada compra caia aqui como contato e cliente,
        automaticamente. Cole a URL do webhook na plataforma e traga o segredo de assinatura para cá.
      </p>

      {itens.map((i) => {
        const m = META[i.plataforma];
        const url = urlDe(i);
        const ligada = i.configurada && i.ativo && i.temSecret;
        return (
          <div key={i.plataforma} className="rounded-md border border-borda bg-superficie p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusDot tom={ligada ? "menta" : "neutro"} />
                <span className="text-sm font-bold text-texto">{m.label}</span>
              </div>
              <Badge tom={ligada ? "menta" : "neutro"}>
                {!i.configurada ? "Não configurada" : i.ativo ? (i.temSecret ? "Ativa" : "Falta o segredo") : "Pausada"}
              </Badge>
            </div>

            <p className="mt-2 text-xs text-texto-suave">{m.onde}</p>

            {url && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-borda bg-fundo-2 px-2.5 py-1.5 text-[11px] text-texto-suave outline-none"
                />
                <button
                  type="button"
                  onClick={() => copiar(i.plataforma, url)}
                  aria-label="Copiar URL do webhook"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-borda text-texto-suave hover:border-marca hover:text-marca"
                >
                  {copiado === i.plataforma ? <Check size={14} className="text-marca" /> : <Copy size={14} />}
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] font-semibold text-texto-suave">
                  Segredo ({m.segredo})
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={secrets[i.plataforma] ?? ""}
                  onChange={(e) => setSecrets((s) => ({ ...s, [i.plataforma]: e.target.value }))}
                  placeholder={i.temSecret ? "•••• configurado — cole para trocar" : `Cole o ${m.segredo}`}
                  className="w-full rounded-md border border-borda bg-fundo px-2.5 py-1.5 text-sm text-texto outline-none focus:border-marca"
                />
              </label>
              <label className="flex items-center gap-1.5 pb-1.5 text-xs text-texto">
                <input
                  type="checkbox"
                  checked={ativos[i.plataforma] ?? false}
                  onChange={(e) => setAtivos((a) => ({ ...a, [i.plataforma]: e.target.checked }))}
                />
                Ativa
              </label>
              <Button
                variant="verde"
                size="sm"
                onClick={() => salvar(i.plataforma)}
                disabled={salvando === i.plataforma}
              >
                {salvando === i.plataforma ? <Loader2 size={14} className="animate-spin" /> : null}
                Salvar
              </Button>
            </div>

            {i.configurada && (
              <button
                type="button"
                onClick={() => regerar(i.plataforma)}
                disabled={salvando === i.plataforma}
                className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-texto-suave hover:text-texto disabled:opacity-50"
              >
                <RefreshCw size={12} /> Gerar novo link
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
