"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { subirDocumento, removerDocumento } from "@/lib/kb/actions";
import type { KbFile } from "@/lib/kb/data";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function KbForm({
  tenantId,
  docs,
  semKey,
}: {
  tenantId: string;
  docs: KbFile[];
  semKey: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<"arquivo" | "texto">("arquivo");
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviandoNome, setEnviandoNome] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    const fd = new FormData();
    if (modo === "arquivo") {
      const f = fileRef.current?.files?.[0];
      if (!f) {
        setErro("Escolha um arquivo (.pdf, .txt, .md).");
        return;
      }
      fd.set("file", f);
      setEnviandoNome(f.name);
    } else {
      if (!texto.trim()) {
        setErro("Cole o texto do documento.");
        return;
      }
      fd.set("texto", texto);
      fd.set("nome", nome || "Texto colado");
      setEnviandoNome(nome || "Texto colado");
    }
    setCarregando(true);
    try {
      const r = await subirDocumento(tenantId, fd);
      if (!r.ok) setErro(r.erro ?? "Falha ao subir o documento.");
      else {
        setOk(`"${r.nome}" indexado em ${r.trechos} trechos.`);
        setTexto("");
        setNome("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } finally {
      setCarregando(false);
      setEnviandoNome("");
    }
  }

  async function remover(fileNome: string) {
    if (!confirm(`Remover "${fileNome}" da base de conhecimento?`)) return;
    const r = await removerDocumento(tenantId, fileNome);
    if (!r.ok) setErro(r.erro ?? "Falha ao remover.");
    else router.refresh();
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6">
      <div className="flex items-center gap-2">
        <BookOpen size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Base de Conhecimento (RAG)</h2>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave">
        <Lock size={13} /> Suba a documentação do cliente. A IA passa a responder com base nela,
        sem inventar. Visível só para o admin.
      </p>

      {semKey && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Falta a chave <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code> no{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> para gerar os embeddings.
          </span>
        </div>
      )}

      {/* Alternador */}
      <div className="mt-5 flex gap-2">
        {(["arquivo", "texto"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              modo === m ? "bg-marca text-bege-principal" : "bg-fundo text-texto-suave"
            }`}
          >
            {m === "arquivo" ? "Enviar arquivo" : "Colar texto"}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="mt-4 space-y-3">
        {modo === "arquivo" ? (
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.csv"
            className="block w-full text-sm text-texto file:mr-3 file:rounded-md file:border-0 file:bg-marca-suave file:px-4 file:py-2 file:text-sm file:font-semibold file:text-marca"
          />
        ) : (
          <>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Título (ex.: Tabela de preços)"
              className={inputCls}
            />
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              placeholder="Cole aqui o conteúdo (preços, FAQ, regras, scripts...)"
              className={inputCls}
            />
          </>
        )}

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
        {ok && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-marca">
            <CheckCircle2 size={15} /> {ok}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="flex items-center gap-2 rounded-sm bg-marca px-5 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {carregando ? "Indexando..." : "Subir e indexar"}
        </button>
      </form>

      {/* Lista de documentos */}
      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
          Documentos indexados
        </p>
        {docs.length === 0 && !carregando ? (
          <p className="rounded-md border border-dashed border-borda px-4 py-6 text-center text-xs italic text-texto-suave">
            Nenhum documento ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {carregando && enviandoNome && (
              <div className="flex items-center gap-3 rounded-md border border-marca/40 bg-marca-suave/30 px-4 py-3">
                <Loader2 size={18} className="shrink-0 animate-spin text-marca" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-texto">{enviandoNome}</p>
                  <p className="text-xs text-texto-suave">Indexando… pode levar alguns segundos.</p>
                </div>
              </div>
            )}
            {docs.map((d) => (
              <div
                key={d.fileNome}
                className="flex items-center justify-between rounded-md border border-borda bg-fundo px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} className="shrink-0 text-marca" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-texto">{d.fileNome}</p>
                    <p className="text-xs text-texto-suave">{d.trechos} trechos indexados</p>
                  </div>
                </div>
                <button
                  onClick={() => remover(d.fileNome)}
                  aria-label="Remover"
                  className="rounded-md p-1.5 text-texto-suave transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
