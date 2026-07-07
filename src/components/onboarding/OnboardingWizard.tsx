"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, Check, Upload, Sparkles, MessageSquare, Rocket } from "lucide-react";
import { Logo } from "@/components/Logo";
import { WhatsAppCard } from "@/components/config/WhatsAppCard";
import { PERSONA_TEMPLATES } from "@/lib/admin/persona-templates";
import { salvarIdentidade, salvarPersonaOnboarding, concluirOnboarding } from "@/lib/onboarding/actions";
import { subirDocumentoCliente } from "@/lib/kb/actions";
import type { OnboardingData } from "@/lib/onboarding/data";

const inputCls =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none focus:border-marca";

const PASSOS = ["Seu negócio", "A sua IA", "Base de conhecimento", "WhatsApp", "Pronto!"];

function Campo({ label, valor, onChange, textarea, dica }: { label: string; valor: string; onChange: (v: string) => void; textarea?: boolean; dica?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-texto">{label}</label>
      {textarea ? (
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} className={inputCls} />
      ) : (
        <input value={valor} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
      {dica && <p className="mt-1 text-xs text-texto-suave">{dica}</p>}
    </div>
  );
}

export function OnboardingWizard({ dados }: { dados: OnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Passo 1 — identidade
  const [nomeNegocio, setNomeNegocio] = useState(dados.nomeNegocio);
  const [endereco, setEndereco] = useState(dados.endereco);
  const [horario, setHorario] = useState(dados.horario);

  // Passo 2 — persona
  const [oferta, setOferta] = useState(dados.oferta);
  const [publico, setPublico] = useState(dados.publico);
  const [tom, setTom] = useState(dados.tom);
  const [objecoes, setObjecoes] = useState(dados.objecoes);
  const [faq, setFaq] = useState(dados.faq);
  const [regras, setRegras] = useState(dados.regras);

  // Passo 3 — base de conhecimento
  const [docs, setDocs] = useState<string[]>([]);
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function aplicarTemplate(id: string) {
    const t = PERSONA_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setOferta(t.oferta);
    setPublico(t.publico);
    setTom(t.tom);
    setObjecoes(t.objecoes);
    setFaq(t.faq);
    setRegras(t.regras);
  }

  async function avancar1() {
    setSalvando(true);
    setErro("");
    const r = await salvarIdentidade({ nomeNegocio, endereco, horario });
    setSalvando(false);
    if (r.ok) setStep(1);
    else setErro(r.erro ?? "Falha ao salvar.");
  }

  async function avancar2() {
    setSalvando(true);
    setErro("");
    const r = await salvarPersonaOnboarding({ oferta, publico, tom, objecoes, faq, regras });
    setSalvando(false);
    if (r.ok) setStep(2);
    else setErro(r.erro ?? "Falha ao salvar.");
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubindo(true);
    setErro("");
    try {
      const fd = new FormData();
      fd.set("file", f);
      const r = await subirDocumentoCliente(fd);
      if (r.ok) setDocs((d) => [...d, r.nome ?? f.name]);
      else setErro(r.erro ?? "Não consegui indexar o documento.");
    } finally {
      setSubindo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function concluir() {
    setSalvando(true);
    const r = await concluirOnboarding();
    setSalvando(false);
    if (r.ok) {
      router.push("/painel");
      router.refresh();
    } else {
      setErro(r.erro ?? "Falha ao concluir.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-2">
      <div className="mb-6 flex items-center justify-between">
        <Logo variante="lockup" tom="escuro" height={26} />
        <button onClick={() => router.push("/painel")} className="text-xs text-texto-suave hover:text-texto">
          Fazer isso depois →
        </button>
      </div>

      {/* Progresso */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-texto-suave">
          <span>
            Passo {step + 1} de {PASSOS.length} · <span className="text-marca">{PASSOS[step]}</span>
          </span>
          <span>{Math.round(((step + 1) / PASSOS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-superficie">
          <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${((step + 1) / PASSOS.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-borda bg-superficie p-6 sm:p-8">
        {/* PASSO 1 — Identidade */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-corpo text-xl font-bold text-texto">Bem-vindo à Lolze! 👋</h1>
              <p className="mt-1 text-sm text-texto-suave">Vamos configurar sua IA em poucos passos. Começando pelo básico do seu negócio.</p>
            </div>
            <Campo label="Nome do negócio" valor={nomeNegocio} onChange={setNomeNegocio} />
            <Campo label="Endereço" valor={endereco} onChange={setEndereco} dica="A IA envia isso quando o cliente pedir." />
            <Campo label="Horário de funcionamento" valor={horario} onChange={setHorario} dica="Ex.: Seg a Sáb, 8h às 18h." />
          </div>
        )}

        {/* PASSO 2 — Persona */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="flex items-center gap-2 font-corpo text-xl font-bold text-texto">
                <Sparkles size={18} className="text-marca" /> Ensine a sua IA
              </h1>
              <p className="mt-1 text-sm text-texto-suave">Escolha um modelo do seu nicho para preencher rápido e ajuste o que quiser.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSONA_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => aplicarTemplate(t.id)} className="rounded-full border border-borda bg-fundo px-3 py-1.5 text-xs font-semibold text-texto hover:border-marca hover:text-marca">
                  {t.nome}
                </button>
              ))}
            </div>
            <Campo label="O que você oferece" valor={oferta} onChange={setOferta} textarea />
            <Campo label="Público-alvo" valor={publico} onChange={setPublico} textarea />
            <Campo label="Tom de voz" valor={tom} onChange={setTom} textarea />
            <Campo label="Objeções comuns (e como responder)" valor={objecoes} onChange={setObjecoes} textarea />
            <Campo label="Perguntas frequentes" valor={faq} onChange={setFaq} textarea />
            <Campo label="Regras (o que a IA deve/não deve fazer)" valor={regras} onChange={setRegras} textarea />
          </div>
        )}

        {/* PASSO 3 — Base de conhecimento */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-corpo text-xl font-bold text-texto">Base de conhecimento</h1>
              <p className="mt-1 text-sm text-texto-suave">
                Suba documentos com seus serviços, preços, durações e regras. É o que deixa a IA precisa (e agenda melhor). Opcional — dá pra fazer depois.
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={onArquivo} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subindo}
              className="flex items-center gap-2 rounded-md border border-marca px-4 py-2 text-sm font-semibold text-marca hover:bg-marca-suave/40 disabled:opacity-50"
            >
              {subindo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {subindo ? "Indexando…" : "Enviar documento (PDF/TXT)"}
            </button>
            {docs.length > 0 && (
              <ul className="space-y-1">
                {docs.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-texto">
                    <Check size={14} className="text-marca" /> {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* PASSO 4 — WhatsApp */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h1 className="flex items-center gap-2 font-corpo text-xl font-bold text-texto">
                <MessageSquare size={18} className="text-marca" /> Conecte seu WhatsApp
              </h1>
              <p className="mt-1 text-sm text-texto-suave">Leia o QR com o WhatsApp do seu negócio. É por aqui que a IA atende.</p>
            </div>
            <div className="rounded-lg border border-borda bg-fundo p-4">
              <WhatsAppCard />
            </div>
          </div>
        )}

        {/* PASSO 5 — Concluir */}
        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-marca-suave text-marca">
              <Rocket size={26} />
            </div>
            <h1 className="font-corpo text-2xl font-bold text-texto">Tudo pronto! 🎉</h1>
            <p className="mx-auto max-w-md text-sm text-texto-suave">
              Ao concluir, sua IA fica <b>ligada</b> e começa a atender. Você ainda pode conectar o Google Calendar e definir o especialista em <b>Configurações → Integrações / Equipe</b> quando quiser.
            </p>
          </div>
        )}

        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}

        {/* Navegação */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto">
              <ArrowLeft size={15} /> Voltar
            </button>
          ) : (
            <span />
          )}

          {step === 0 && (
            <BtnContinuar onClick={avancar1} loading={salvando} />
          )}
          {step === 1 && (
            <BtnContinuar onClick={avancar2} loading={salvando} />
          )}
          {step === 2 && (
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)} className="text-sm font-semibold text-texto-suave hover:text-texto">
                Pular
              </button>
              <BtnContinuar onClick={() => setStep(3)} />
            </div>
          )}
          {step === 3 && <BtnContinuar onClick={() => setStep(4)} rotulo="Continuar" />}
          {step === 4 && (
            <button
              onClick={concluir}
              disabled={salvando}
              className="flex items-center gap-2 rounded-md bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Concluir e ligar a IA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BtnContinuar({ onClick, loading, rotulo = "Salvar e continuar" }: { onClick: () => void; loading?: boolean; rotulo?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-md bg-marca px-5 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.02] disabled:opacity-60"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
      {loading ? "Salvando…" : rotulo}
    </button>
  );
}
