"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download, FileText, Trash2, BookOpen } from "lucide-react";
import { subirDocumentoCliente, removerDocumentoCliente } from "@/lib/kb/actions";
import type { KbFile } from "@/lib/kb/data";

/**
 * Aba "Base de conhecimento" (cliente): baixa o modelo, sobe documentos e
 * gerencia o que já está na base. É o que ensina a IA sobre o negócio.
 */
export function ConhecimentoCard({ docs: docsIniciais }: { docs: KbFile[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<KbFile[]>(docsIniciais);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState("");

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubindo(true);
    setErro("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await subirDocumentoCliente(fd);
    setSubindo(false);
    if (fileRef.current) fileRef.current.value = "";
    if (r.ok && r.nome) {
      const nome = r.nome;
      setDocs((d) => [
        { fileNome: nome, trechos: r.trechos ?? 0, criadoEm: new Date().toISOString() },
        ...d.filter((x) => x.fileNome !== nome),
      ]);
    } else {
      setErro(r.erro || "Não foi possível enviar o documento.");
    }
  }

  async function remover(fileNome: string) {
    if (!confirm(`Remover "${fileNome}" da base de conhecimento? A IA deixa de usar esse conteúdo.`))
      return;
    const r = await removerDocumentoCliente(fileNome);
    if (r.ok) setDocs((d) => d.filter((x) => x.fileNome !== fileNome));
    else setErro(r.erro || "Não foi possível remover.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-corpo text-lg font-bold text-texto">
          <BookOpen size={18} className="text-marca" /> Base de conhecimento
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Documentos com seus serviços, preços, durações e regras. É o que deixa a IA precisa e
          faz ela agendar melhor.
        </p>
      </div>

      {/* Modelo pronto */}
      <div className="rounded-lg border border-marca/30 bg-marca-suave/30 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-texto">
          <FileText size={16} className="text-marca" /> Não sabe o que escrever?
        </p>
        <p className="mt-1 text-xs text-texto-suave">
          Baixe nosso modelo, preencha com as informações do seu negócio e envie aqui.
        </p>
        <a
          href="/modelo-conhecimento-lolze.txt"
          download
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-escuro-quente px-4 py-2 text-sm font-semibold text-bege-principal transition-transform hover:scale-[1.02]"
        >
          <Download size={16} /> Baixar modelo (.txt)
        </a>
      </div>

      {/* Enviar documento */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,.csv"
          onChange={onArquivo}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={subindo}
          className="flex items-center gap-2 rounded-md border border-marca px-4 py-2.5 text-sm font-semibold text-marca hover:bg-marca-suave/40 disabled:opacity-50"
        >
          {subindo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {subindo ? "Indexando…" : "Enviar documento (PDF, TXT, MD, CSV)"}
        </button>
        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      </div>

      {/* Documentos já enviados */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
          Documentos na base ({docs.length})
        </p>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda bg-fundo p-6 text-center text-sm text-texto-suave">
            Nenhum documento ainda. Baixe o modelo, preencha e envie acima.
          </p>
        ) : (
          <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
            {docs.map((d) => (
              <li key={d.fileNome} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={15} className="shrink-0 text-texto-suave" />
                  <span className="truncate text-sm text-texto">{d.fileNome}</span>
                  <span className="shrink-0 text-xs text-texto-suave">· {d.trechos} trechos</span>
                </div>
                <button
                  onClick={() => remover(d.fileNome)}
                  aria-label="Remover"
                  className="shrink-0 rounded-md p-2.5 text-texto-suave transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
