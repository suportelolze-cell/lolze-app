"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2, Image, Video, Music, FileText, Send } from "lucide-react";
import { crmBrowser } from "@/lib/supabase/browser";
import {
  criarUploadBiblioteca,
  adicionarItemBiblioteca,
  removerItemBiblioteca,
  alternarItemBiblioteca,
} from "@/lib/biblioteca/actions";
import { tipoDeMime, dentroDoLimite, extDeNome, limiteMb, type MidiaTipo } from "@/lib/atendimento/midia-core";
import type { ItemBiblioteca } from "@/lib/biblioteca/data";

const ICONE: Record<MidiaTipo, typeof Image> = {
  imagem: Image,
  video: Video,
  audio: Music,
  documento: FileText,
};

export function BibliotecaMidiaCard({ inicial }: { inicial: ItemBiblioteca[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [quando, setQuando] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setArquivo(f);
    if (f && !nome) setNome(f.name.replace(/\.[a-z0-9]+$/i, ""));
  }

  async function adicionar() {
    setErro("");
    if (!arquivo) {
      setErro("Escolha um arquivo.");
      return;
    }
    if (!nome.trim()) {
      setErro("Dê um nome ao arquivo (ex.: Tabela de preços).");
      return;
    }
    const mime = arquivo.type || "application/octet-stream"; // alguns SOs não preenchem o MIME
    const tipo = tipoDeMime(mime);
    if (!tipo) {
      setErro("Tipo de arquivo não suportado.");
      return;
    }
    if (!dentroDoLimite(tipo, arquivo.size)) {
      setErro(`Arquivo muito grande para ${tipo}. Limite: ${limiteMb(tipo)} MB.`);
      return;
    }
    setSalvando(true);
    try {
      const up = await criarUploadBiblioteca(extDeNome(arquivo.name));
      if (!up.ok || !up.path || !up.token) {
        setErro(up.erro ?? "Não foi possível preparar o upload.");
        return;
      }
      const { error } = await crmBrowser.storage
        .from("midias")
        .uploadToSignedUrl(up.path, up.token, arquivo);
      if (error) {
        setErro("Falha no upload do arquivo.");
        return;
      }
      const r = await adicionarItemBiblioteca({
        path: up.path,
        nome: nome.trim(),
        quandoUsar: quando.trim(),
        mime,
        filename: arquivo.name,
      });
      if (!r.ok) {
        // O servidor (service_role) limpa o órfão do Storage em caso de falha.
        setErro(r.erro ?? "Não foi possível salvar.");
        return;
      }
      setArquivo(null);
      setNome("");
      setQuando("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    setErro("");
    setRemovendo(id);
    try {
      const r = await removerItemBiblioteca(id);
      if (!r.ok) setErro(r.erro ?? "Não foi possível remover.");
      else router.refresh();
    } finally {
      setRemovendo(null);
    }
  }

  async function alternar(id: string, ativo: boolean) {
    setErro("");
    setAlternando(id);
    try {
      const r = await alternarItemBiblioteca(id, ativo);
      if (!r.ok) setErro(r.erro ?? "Não foi possível atualizar o arquivo.");
      else router.refresh();
    } finally {
      setAlternando(null);
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Send size={18} className="text-marca" />
        <h3 className="font-corpo text-lg font-bold text-texto">Arquivos que a IA pode enviar</h3>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        Deixe arquivos prontos (tabela de preços, fotos, vídeos, catálogo…). Diga <strong>quando usar</strong> cada
        um e a IA envia sozinha na hora certa da conversa.
      </p>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {inicial.length === 0 && (
          <p className="rounded-lg border border-dashed border-borda px-4 py-6 text-center text-sm text-texto-suave">
            Nenhum arquivo ainda. Adicione o primeiro abaixo.
          </p>
        )}
        {inicial.map((item) => {
          const Icone = ICONE[item.tipo] ?? FileText;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border border-borda p-3 ${
                item.ativo ? "" : "opacity-60"
              }`}
            >
              <Icone size={18} className="mt-0.5 shrink-0 text-texto-suave" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-texto">{item.nome}</p>
                {item.quandoUsar && (
                  <p className="mt-0.5 text-xs text-texto-suave">Enviar quando: {item.quandoUsar}</p>
                )}
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-texto-suave">
                <input
                  type="checkbox"
                  checked={item.ativo}
                  disabled={alternando === item.id}
                  onChange={(e) => alternar(item.id, e.target.checked)}
                />
                Ativo
              </label>
              <button
                onClick={() => remover(item.id)}
                disabled={removendo === item.id}
                aria-label="Remover"
                className="shrink-0 rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-red-600 disabled:opacity-50"
              >
                {removendo === item.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Adicionar */}
      <div className="mt-4 space-y-2 rounded-lg border border-borda bg-fundo p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={escolher}
          className="block w-full text-sm text-texto file:mr-3 file:rounded-md file:border-0 file:bg-marca-suave file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-marca"
        />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex.: Tabela de preços)"
          className="w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto outline-none focus:border-marca"
        />
        <input
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          placeholder="Quando usar (ex.: quando perguntarem o valor)"
          className="w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto outline-none focus:border-marca"
        />
        <button
          onClick={adicionar}
          disabled={salvando}
          className="flex items-center gap-2 rounded-sm bg-marca px-4 py-2 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {salvando ? "Enviando…" : "Adicionar arquivo"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}
    </div>
  );
}
