"use client";

import { useRef, useState } from "react";
import {
  Radar,
  Upload,
  Loader2,
  Save,
  Check,
  Sparkles,
  Trash2,
  AlertTriangle,
  Bot,
  PencilLine,
} from "lucide-react";
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

/**
 * Célula de planilha (xlsx) → texto seguro para o CSV de ';' do parser do servidor.
 * Remove `;` (o delimitador), `,` (senão o detector de delimitador do servidor
 * pode escolher ',' se o cabeçalho tiver vírgulas e desmontar as linhas) e
 * quebras de linha. Date vira "" (uma data numa célula de nome/telefone é erro
 * do usuário e não deve virar um "telefone" de dígitos-lixo).
 */
function celulaSegura(v: unknown): string {
  if (v === null || v === undefined || v instanceof Date) return "";
  return String(v).replace(/[\r\n;,]+/g, " ").trim();
}

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
  const [erroSalvar, setErroSalvar] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultImport, setResultImport] = useState("");
  const [previa, setPrevia] = useState("");
  const [gerando, setGerando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const modoTexto = cfg.modo === "texto";

  async function salvar() {
    setSalvando(true);
    setErroSalvar("");
    const r = await setCaptacaoCfg({
      instancia: cfg.instancia,
      porDia: cfg.porDia,
      ativo: cfg.ativo,
      modo: cfg.modo,
      mensagem: cfg.mensagem,
    });
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } else {
      setErroSalvar(r.erro ?? "Não foi possível salvar.");
    }
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportando(true);
    setResultImport("");
    try {
      const nome = f.name.toLowerCase();
      let texto: string;
      if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
        // Lê o Excel no navegador (lib carregada sob demanda) e converte para
        // um CSV de ; que o parser do servidor já entende — reaproveita tudo.
        // v9: readSheet devolve as linhas da 1ª aba (Row[]); o default devolve
        // um array de abas. Carrega sob demanda (fica fora do bundle inicial).
        const { readSheet } = await import("read-excel-file/browser");
        const linhas = await readSheet(f);
        texto = linhas.map((linha) => linha.map(celulaSegura).join(";")).join("\n");
      } else {
        texto = await f.text();
      }
      const r = await importarProspectsCsv(texto);
      setResultImport(
        r.ok
          ? `✅ ${r.inseridos} novo(s) contato(s) importado(s) (de ${r.lidos} linhas). Atualize a página para ver a lista.`
          : r.erro ?? "Não foi possível importar."
      );
    } catch (err) {
      setResultImport("Não consegui ler o arquivo: " + (err as Error).message);
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function previewMsg() {
    setGerando(true);
    setPrevia("");
    const r = await gerarPrevia({ modo: cfg.modo, mensagem: cfg.mensagem });
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
          <Radar size={22} className="text-marca" /> Captação & Disparos
        </h1>
        <p className="mt-1 text-texto-suave">
          Suba a lista e escolha: a <b>IA escreve</b> uma abordagem fria e personalizada, ou{" "}
          <b>você escreve</b> o texto de um disparo (uma oferta). Nos dois casos o envio sai em baixo
          volume pelo número dedicado, e quem responde vira lead no atendimento automático.
        </p>
      </header>

      {/* Aviso de segurança */}
      <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          Use um <b>número dedicado e aquecido</b> (não o WhatsApp que atende seus clientes) e
          mantenha o volume baixo. Envio em massa tem risco de bloqueio e envolve LGPD, prefira
          telefones de <b>empresa</b>, personalize com <code>{"{nome}"}</code> e respeite quem pedir
          para não receber.
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
          <h2 className="font-corpo text-lg font-bold text-texto">Configuração do envio</h2>

          {/* Seletor de modo */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-texto">Modo da mensagem</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, modo: "ia" })}
                className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  !modoTexto
                    ? "border-marca/50 bg-marca-suave text-marca"
                    : "border-borda bg-fundo text-texto-suave hover:bg-fundo/60"
                }`}
              >
                <Bot size={16} /> IA escreve
              </button>
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, modo: "texto" })}
                className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  modoTexto
                    ? "border-marca/50 bg-marca-suave text-marca"
                    : "border-borda bg-fundo text-texto-suave hover:bg-fundo/60"
                }`}
              >
                <PencilLine size={16} /> Eu escrevo
              </button>
            </div>
            <p className="mt-1 text-xs text-texto-suave">
              {modoTexto
                ? "Disparo com o SEU texto (ex.: uma oferta). O mesmo texto vai para cada contato da lista."
                : "A IA redige uma abordagem fria, curta e personalizada para cada contato."}
            </p>
          </div>

          {/* Texto do disparo (só no modo texto) */}
          {modoTexto && (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-texto">Texto do disparo</label>
              <textarea
                value={cfg.mensagem}
                maxLength={1000}
                rows={5}
                onChange={(e) => setCfg({ ...cfg, mensagem: e.target.value })}
                placeholder={"Ex.: Olá {nome}! Estamos com uma oferta especial em {cidade} esta semana. Posso te contar?"}
                className="w-full resize-y rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
              />
              <p className="mt-1 text-xs text-texto-suave">
                Use <code>{"{nome}"}</code>, <code>{"{empresa}"}</code>, <code>{"{cidade}"}</code>,{" "}
                <code>{"{nicho}"}</code>: a Lolze troca por cada contato.{" "}
                <span className="tabular-nums">{cfg.mensagem.length}/1000</span>
              </p>
            </div>
          )}

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
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full sm:w-32">
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
                {cfg.ativo ? "Envios ligados" : "Envios desligados"}
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
            {erroSalvar && <p className="text-sm font-medium text-red-600">{erroSalvar}</p>}
          </div>
        </div>

        {/* Importar + prévia */}
        <div className="rounded-lg border border-borda bg-superficie p-6">
          <h2 className="font-corpo text-lg font-bold text-texto">Importar lista (planilha)</h2>
          <p className="mt-1 text-xs text-texto-suave">
            Aceita <b>Excel (.xlsx)</b> ou <b>CSV</b>, com colunas: <b>nome/empresa</b>,{" "}
            <b>telefone</b>, e opcionalmente site, nicho e cidade (a 1ª linha é o cabeçalho).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onArquivo}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importando}
              className="flex items-center gap-2 rounded-md border border-marca px-4 py-2 text-sm font-semibold text-marca hover:bg-marca-suave/40 disabled:opacity-50"
            >
              {importando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importando ? "Importando…" : "Enviar planilha"}
            </button>
            <button
              onClick={previewMsg}
              disabled={gerando}
              className="flex items-center gap-2 rounded-md border border-borda px-4 py-2 text-sm font-semibold text-texto hover:bg-fundo disabled:opacity-50"
            >
              {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {modoTexto ? "Ver prévia do disparo" : "Ver prévia da abordagem"}
            </button>
          </div>
          {resultImport && <p className="mt-3 text-sm font-medium text-texto">{resultImport}</p>}
          {previa && (
            <div className="mt-3 rounded-lg border border-borda bg-fundo p-3 text-sm text-texto">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-marca">
                <Sparkles size={12} />{" "}
                {modoTexto
                  ? "Como o disparo vai chegar (1º contato da fila)"
                  : "Exemplo de mensagem que a IA enviaria"}
              </div>
              <p className="whitespace-pre-wrap">{previa}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-lg border border-borda bg-superficie">
        <div className="border-b border-borda px-5 py-3 text-sm font-bold text-texto">
          Contatos ({prospects.length})
        </div>
        {prospects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-texto-suave">
            Nenhum contato ainda. Importe uma planilha para começar.
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
                      className="-mr-1.5 shrink-0 p-2 text-texto-suave hover:text-red-600"
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
