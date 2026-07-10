"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Heart,
  MessageCircle,
  Plus,
  Send,
  X,
  Loader2,
  ChevronRight,
  BadgeCheck,
} from "lucide-react";
import type { Ideia, StatusIdeia } from "@/lib/ideias/data";
import {
  criarIdeia,
  curtirIdeia,
  comentarIdeia,
  mudarStatusIdeia,
  listarComentarios,
  type Comentario,
} from "@/lib/ideias/actions";

const STATUS_META: Record<StatusIdeia, { label: string; dot: string; chip: string }> = {
  analise: { label: "Em análise", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
  aprovado: { label: "Aprovada", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-700" },
  execucao: { label: "Em execução", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  entregue: { label: "Entregue", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  recusado: { label: "Não agora", dot: "bg-rose-400", chip: "bg-rose-100 text-rose-600" },
};

const FLUXO: StatusIdeia[] = ["analise", "aprovado", "execucao", "entregue"];
const TODOS_STATUS: StatusIdeia[] = ["analise", "aprovado", "execucao", "entregue", "recusado"];
const FILTROS: { valor: "todas" | StatusIdeia; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "analise", label: "Em análise" },
  { valor: "aprovado", label: "Aprovadas" },
  { valor: "execucao", label: "Em execução" },
  { valor: "entregue", label: "Entregues" },
];

export function MuralIdeias({
  ideiasIniciais,
  souAdmin,
}: {
  ideiasIniciais: Ideia[];
  souAdmin: boolean;
}) {
  const router = useRouter();
  const [ideias, setIdeias] = useState<Ideia[]>(ideiasIniciais);
  const [filtro, setFiltro] = useState<"todas" | StatusIdeia>("todas");
  const [novaAberta, setNovaAberta] = useState(false);

  // Reconcilia com o servidor sempre que ele revalida (nova ideia, status etc.).
  useEffect(() => setIdeias(ideiasIniciais), [ideiasIniciais]);

  const visiveis = useMemo(
    () => (filtro === "todas" ? ideias : ideias.filter((i) => i.status === filtro)),
    [ideias, filtro]
  );

  function toggleCurtir(id: string) {
    setIdeias((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, euCurti: !i.euCurti, curtidas: i.curtidas + (i.euCurti ? -1 : 1) } : i
      )
    );
    curtirIdeia(id).then(() => router.refresh());
  }

  function alterarStatus(id: string, status: StatusIdeia) {
    setIdeias((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    mudarStatusIdeia(id, status).then(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl italic text-texto sm:text-3xl">
            <Lightbulb className="text-marca" size={26} /> Ideias &amp; Novidades
          </h1>
          <p className="mt-1 max-w-xl text-sm text-texto-suave">
            Sugira o que a Lolze deve construir, curta as ideias que você quer ver primeiro e
            acompanhe em tempo real o que já está sendo feito. Você faz parte disso. 💚
          </p>
        </div>
        <button
          onClick={() => setNovaAberta((v) => !v)}
          className="hidden shrink-0 items-center gap-2 rounded-full bg-marca px-4 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.02] sm:flex"
        >
          <Plus size={16} /> Sugerir ideia
        </button>
      </div>

      {/* Botão mobile */}
      <button
        onClick={() => setNovaAberta((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-marca px-4 py-3 text-sm font-bold text-bege-principal sm:hidden"
      >
        <Plus size={16} /> Sugerir ideia
      </button>

      {/* Formulário nova ideia */}
      {novaAberta && (
        <FormNovaIdeia
          onFechar={() => setNovaAberta(false)}
          onCriada={() => {
            setNovaAberta(false);
            router.refresh();
          }}
        />
      )}

      {/* Legenda do fluxo */}
      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-borda bg-superficie px-4 py-3 text-xs text-texto-suave">
        <span className="font-semibold text-texto">Como funciona:</span>
        {FLUXO.map((st, i) => (
          <span key={st} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[st].dot}`} />
              {STATUS_META[st].label}
            </span>
            {i < FLUXO.length - 1 && <ChevronRight className="text-borda" size={14} />}
          </span>
        ))}
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtro === f.valor
                ? "bg-escuro-quente text-bege-principal"
                : "border border-borda bg-superficie text-texto-suave hover:text-texto"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-3">
        {visiveis.length === 0 ? (
          <div className="rounded-xl border border-dashed border-borda bg-superficie px-6 py-12 text-center text-sm text-texto-suave">
            Nenhuma ideia por aqui ainda. Que tal ser a primeira pessoa a sugerir? 💡
          </div>
        ) : (
          visiveis.map((i) => (
            <CardIdeia
              key={i.id}
              ideia={i}
              souAdmin={souAdmin}
              onCurtir={() => toggleCurtir(i.id)}
              onStatus={(st) => alterarStatus(i.id, st)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FormNovaIdeia({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro("");
    setEnviando(true);
    const r = await criarIdeia(titulo, descricao);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não consegui salvar.");
      return;
    }
    setTitulo("");
    setDescricao("");
    onCriada();
  }

  return (
    <div className="mt-4 rounded-xl border border-borda bg-superficie p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-texto">Sua ideia</h3>
        <button onClick={onFechar} className="text-texto-suave hover:text-texto" aria-label="Fechar">
          <X size={16} />
        </button>
      </div>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={140}
        placeholder="Ex.: Integração com o Instagram Direct"
        className="mt-3 w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Conte com suas palavras o que isso resolveria e por quê. (opcional)"
        className="mt-2 w-full resize-none rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca"
      />
      {erro && <p className="mt-2 text-xs text-rose-500">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onFechar}
          className="rounded-full px-4 py-2 text-sm font-semibold text-texto-suave hover:text-texto"
        >
          Cancelar
        </button>
        <button
          onClick={enviar}
          disabled={enviando}
          className="flex items-center gap-2 rounded-full bg-marca px-4 py-2 text-sm font-bold text-bege-principal disabled:opacity-60"
        >
          {enviando ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Enviar ideia
        </button>
      </div>
    </div>
  );
}

function CardIdeia({
  ideia,
  souAdmin,
  onCurtir,
  onStatus,
}: {
  ideia: Ideia;
  souAdmin: boolean;
  onCurtir: () => void;
  onStatus: (s: StatusIdeia) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const meta = STATUS_META[ideia.status];

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="flex items-start gap-3">
        {/* Curtir */}
        <button
          onClick={onCurtir}
          className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
            ideia.euCurti
              ? "border-marca bg-marca/10 text-marca"
              : "border-borda text-texto-suave hover:border-marca hover:text-marca"
          }`}
          aria-label="Curtir ideia"
        >
          <Heart size={16} className={ideia.euCurti ? "fill-current" : ""} />
          <span className="text-xs font-bold">{ideia.curtidas}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
            </span>
            {ideia.minha && (
              <span className="text-[11px] font-medium text-texto-suave">· sua ideia</span>
            )}
          </div>

          <h3 className="mt-1.5 font-corpo text-[15px] font-bold leading-snug text-texto">
            {ideia.titulo}
          </h3>
          {ideia.descricao && (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-texto-suave">
              {ideia.descricao}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-texto-suave">
            <span>por {ideia.autorNome}</span>
            <button
              onClick={() => setAberto((v) => !v)}
              className="flex items-center gap-1 hover:text-texto"
            >
              <MessageCircle size={14} /> {ideia.comentarios}{" "}
              {ideia.comentarios === 1 ? "comentário" : "comentários"}
            </button>
            {souAdmin && (
              <select
                value={ideia.status}
                onChange={(e) => onStatus(e.target.value as StatusIdeia)}
                className="ml-auto rounded-md border border-borda bg-fundo px-2 py-1 text-xs font-semibold text-texto outline-none focus:border-marca"
                title="Mudar etapa (admin)"
              >
                {TODOS_STATUS.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_META[st].label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {aberto && <PainelComentarios ideiaId={ideia.id} />}
        </div>
      </div>
    </div>
  );
}

function PainelComentarios({ ideiaId }: { ideiaId: string }) {
  const router = useRouter();
  const [coms, setComs] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarComentarios(ideiaId).then((c) => {
      if (vivo) setComs(c);
    });
    return () => {
      vivo = false;
    };
  }, [ideiaId]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    const r = await comentarIdeia(ideiaId, t);
    setEnviando(false);
    if (r.ok) {
      setTexto("");
      setComs(await listarComentarios(ideiaId));
      router.refresh(); // atualiza o contador do card
    }
  }

  return (
    <div className="mt-3 border-t border-borda pt-3">
      {coms === null ? (
        <p className="flex items-center gap-2 text-xs text-texto-suave">
          <Loader2 className="animate-spin" size={13} /> Carregando…
        </p>
      ) : coms.length === 0 ? (
        <p className="text-xs text-texto-suave">Ainda sem comentários. Comece a conversa. 👇</p>
      ) : (
        <ul className="space-y-2.5">
          {coms.map((c) => (
            <li key={c.id} className="text-sm leading-relaxed">
              <span className="font-semibold text-texto">{c.autorNome}</span>
              {c.admin && (
                <span className="mx-1.5 inline-flex items-center gap-1 rounded-full bg-marca px-1.5 py-0.5 align-middle text-[10px] font-bold text-bege-principal">
                  <BadgeCheck size={11} /> Equipe Lolze
                </span>
              )}{" "}
              <span className="text-texto-suave">{c.texto}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
          maxLength={1000}
          placeholder="Escreva um comentário…"
          className="flex-1 rounded-full border border-borda bg-fundo px-3 py-2 text-sm text-texto outline-none focus:border-marca"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca text-bege-principal disabled:opacity-50"
          aria-label="Enviar comentário"
        >
          {enviando ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
