"use client";

import { useRef, useState } from "react";
import { Radar, Upload, Loader2, Save, Check, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import {
  importarProspectsCsv,
  setCaptacaoCfg,
  descartarProspect,
  gerarPrevia,
} from "@/lib/captacao/actions";
import type { CaptacaoCfg, CaptacaoResumo, ProspectRow } from "@/lib/captacao/data";

const STATUS_ROTULO: Record<string, { txt: string; cor: string }> = {
  novo: { txt: "Na fila", cor: "bg-superficie text-texto-suave" },
  enviado: { txt: "Enviado", cor: "bg-marca-suave text-marca" },
  respondeu: { txt: "Respondeu 🔥", cor: "bg-orange-100 text-orange-700" },
  descartado: { txt: "Descartado", cor: "bg-superficie text-texto-suave/60" },
  erro: { txt: "Erro", cor: "bg-red-100 text-red-600" },
};

export function Captacao({
  cfgInicial,
  resumo,
  prospects,
}: {
  cfgInicial: CaptacaoCfg;
  resumo: CaptacaoResumo;
  prospects: ProspectRow[];
}) {
  const [cfg, setCfg] = useState(cfgInicial);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultImport, setResultImport] = useState("");
  const [previa, setPrevia] = useState("");
  const [gerando, setGerando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function salvar() {
    setSalvando(true);
    const r = await setCaptacaoCfg({ instancia: cfg.instancia, porDia: cfg.porDia, ativo: cfg.ativo });
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportando(true);
    setResultImport("");
    try {
      const texto = await f.text();
      const r = await importarProspectsCsv(texto);
      setResultImport(
        r.ok
          ? `✅ ${r.inseridos} novo(s) prospect(s) importado(s) (de ${r.lidos} linhas). Atualize a página para ver a lista.`
          : r.erro ?? "Não foi possível importar."
      );
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function previewMsg() {
    setGerando(true);
    setPrevia("");
    const r = await gerarPrevia();
    setGerando(false);
    setPrevia(r.ok ? (r.mensagem ?? "") : r.erro ?? "Falha ao gerar.");
  }

  async function descartar(id: number) {
    await descartarProspect(id);
    // Otimista: some da tela (a lista recarrega no próximo refresh).
    const el = document.getElementById(`prosp-${id}`);
    if (el) el.style.opacity = "0.35";
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-medium italic tracking-tight text-texto">
          <Radar size={22} className="text-marca" /> Captação
        </h1>
        <p className="mt-1 text-texto-suave">
          Prospecção assistida: sobe a lista, a IA escreve a abordagem e envia em baixo volume pelo
          número dedicado. Quem responde vira lead e cai no atendimento automático.
        </p>
      </header>

      {/* Aviso de segurança */}
      <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          Use um <b>número dedicado e aquecido</b> (não o WhatsApp que atende seus clientes) e
          mantenha o volume baixo. Prospecção fria tem risco de bloqueio e envolve LGPD — prefira
          telefones de <b>empresa</b> e respeite quem pedir para não receber.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Total", resumo.total],
          ["Na fila", resumo.novo],
          ["Enviados", resumo.enviado],
          ["Responderam", resumo.respondeu],
          ["Descartados", resumo.descartado],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-lg border border-borda bg-superficie p-4">
            <div className="text-2xl font-bold text-texto">{n as number}</div>
            <div className="text-xs text-texto-suave">{label as string}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config */}
        <div className="rounded-lg border border-borda bg-superficie p-6">
          <h2 className="font-corpo text-lg font-bold text-texto">Configuração do disparo</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-texto">Número de disparo</label>
              {cfg.instancias.length === 0 ? (
                <p className="rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto-suave">
                  Nenhum número conectado. Vá em <b>Configurações → Integrações → Números de
                  Captação</b> e conecte um chip dedicado por QR.
                </p>
              ) : (
                <select
                  value={cfg.instancia}
                  onChange={(e) => setCfg({ ...cfg, instancia: e.target.value })}
                  className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
                >
                  <option value="">Selecione um número…</option>
                  {cfg.instancias.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-texto-suave">
                Escolha o número dedicado que a Lolze liberou para você.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <div className="w-32">
                <label className="mb-1 block text-sm font-semibold text-texto">Envios por dia</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={cfg.porDia}
                  onChange={(e) => setCfg({ ...cfg, porDia: Number(e.target.value) })}
                  className="w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
                />
              </div>
              <button
                onClick={() => setCfg({ ...cfg, ativo: !cfg.ativo })}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                  cfg.ativo
                    ? "border-marca/40 bg-marca-suave text-marca"
                    : "border-borda bg-fundo text-texto-suave"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${cfg.ativo ? "bg-marca" : "bg-texto-suave/40"}`} />
                {cfg.ativo ? "Captação ligada" : "Captação desligada"}
              </button>
            </div>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-2 rounded-sm bg-marca px-4 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {salvo ? <Check size={16} /> : <Save size={16} />}
              {salvo ? "Salvo!" : salvando ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>
        </div>

        {/* Importar + prévia */}
        <div className="rounded-lg border border-borda bg-superficie p-6">
          <h2 className="font-corpo text-lg font-bold text-texto">Importar lista (planilha)</h2>
          <p className="mt-1 text-xs text-texto-suave">
            Envie um CSV com colunas: <b>nome/empresa</b>, <b>telefone</b>, e opcionalmente site,
            nicho e cidade. (O importador da Apify entra aqui em breve.)
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onArquivo} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importando}
              className="flex items-center gap-2 rounded-md border border-marca px-4 py-2 text-sm font-semibold text-marca hover:bg-marca-suave/40 disabled:opacity-50"
            >
              {importando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importando ? "Importando…" : "Enviar CSV"}
            </button>
            <button
              onClick={previewMsg}
              disabled={gerando}
              className="flex items-center gap-2 rounded-md border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo disabled:opacity-50"
            >
              {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Ver prévia da abordagem
            </button>
          </div>
          {resultImport && <p className="mt-3 text-sm font-medium text-texto">{resultImport}</p>}
          {previa && (
            <div className="mt-3 rounded-lg border border-borda bg-fundo p-3 text-sm text-texto">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-marca">
                <Sparkles size={12} /> Exemplo de mensagem que a IA enviaria
              </div>
              {previa}
            </div>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-lg border border-borda bg-superficie">
        <div className="border-b border-borda px-5 py-3 text-sm font-bold text-texto">
          Prospects ({prospects.length})
        </div>
        {prospects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-texto-suave">
            Nenhum prospect ainda. Importe uma planilha para começar.
          </div>
        ) : (
          <div className="divide-y divide-borda">
            {prospects.map((p) => {
              const st = STATUS_ROTULO[p.status] ?? STATUS_ROTULO.novo;
              return (
                <div
                  key={p.id}
                  id={`prosp-${p.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm transition-opacity"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-texto">
                      {p.nome_empresa || p.telefone}
                    </div>
                    <div className="truncate text-xs text-texto-suave">
                      {[p.telefone, p.nicho, p.cidade].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cor}`}>
                    {st.txt}
                  </span>
                  {p.status === "novo" && (
                    <button
                      onClick={() => descartar(p.id)}
                      aria-label="Descartar"
                      className="shrink-0 text-texto-suave hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
