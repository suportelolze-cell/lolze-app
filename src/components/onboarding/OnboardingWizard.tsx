"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, Check, Upload, Sparkles, MessageSquare, Rocket, Download, FileText, Store, GraduationCap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { WhatsAppCard } from "@/components/config/WhatsAppCard";
import { PERSONA_TEMPLATES } from "@/lib/admin/persona-templates";
import { salvarIdentidade, salvarPersonaOnboarding, concluirOnboarding } from "@/lib/onboarding/actions";
import { salvarPlaybook } from "@/lib/agent/playbook-actions";
import { subirDocumentoCliente } from "@/lib/kb/actions";
import type { OnboardingData } from "@/lib/onboarding/data";
import type { PlaybookCopy } from "@/lib/copy/secoes";
import { Button, buttonClasses } from "@/components/ui";

// Exemplos e dicas que mudam conforme o tipo de operação. É o que faz o
// onboarding falar a língua do cliente (lojista/serviço x infoproduto).
const DICAS: Record<PlaybookCopy, {
  intro1: string; enderecoDica: string; horarioDica: string;
  intro2: string; oferta: string; publico: string; tom: string; objecoes: string; faq: string; regras: string;
  conclusao: string;
}> = {
  servico_local: {
    intro1: "Vamos configurar sua IA em poucos passos. Começando pelo básico do seu negócio.",
    enderecoDica: "A IA envia isso quando o cliente pedir.",
    horarioDica: "Ex.: Seg a Sáb, 8h às 18h.",
    intro2: "Escolha um modelo do seu nicho para preencher rápido e ajuste o que quiser.",
    oferta: "Seus serviços ou produtos, em linguagem simples. Ex.: 'corte e barba', 'bolos por encomenda', 'conserto de celular'.",
    publico: "Quem é o seu cliente típico. Ex.: 'moradores do bairro', 'mães da região', 'quem quebrou a tela'.",
    tom: "Como a IA deve falar. Ex.: 'próximo e simpático, como no balcão', 'sem gírias, direto ao ponto'.",
    objecoes: "O que o cliente costuma questionar e a melhor resposta. Ex.: 'Tá caro → explico que inclui X e faço em Y'.",
    faq: "As perguntas que você mais recebe no WhatsApp, com a resposta. Ex.: 'Tem estacionamento? Sim, na frente.'",
    regras: "Limites claros. Ex.: 'nunca dar desconto sem eu autorizar', 'não confirmar horário fora do funcionamento'.",
    conclusao: "Ao concluir, sua IA fica ligada e começa a atender. Você ainda pode conectar o Google Calendar e definir o especialista em Configurações → Integrações / Equipe quando quiser.",
  },
  infoproduto: {
    intro1: "Vamos configurar sua IA em poucos passos. Começando pelo básico da sua operação.",
    enderecoDica: "Se você atende só online, pode deixar em branco.",
    horarioDica: "O horário em que você (ou seu time) responde. Ex.: Seg a Sex, 9h às 18h.",
    intro2: "Preencha sobre o seu produto e a sua audiência, e ajuste o que quiser.",
    oferta: "Seu produto digital, em linguagem simples. Ex.: 'curso de tráfego pago', 'mentoria de emagrecimento', 'ebook de finanças'.",
    publico: "Quem é o seu comprador típico. Ex.: 'quem quer aprender a investir', 'donas de loja online', 'iniciantes em inglês'.",
    tom: "Como a IA deve falar. Ex.: 'motivador e direto, de quem já teve o resultado', 'leve e didático'.",
    objecoes: "A dúvida que trava a compra e a melhor resposta. Ex.: 'Será que funciona pra mim? → mostro casos e a garantia de 7 dias'.",
    faq: "As perguntas que mais aparecem antes de comprar, com a resposta. Ex.: 'Tem garantia? 7 dias.', 'Recebo o acesso na hora? Sim, por e-mail.'",
    regras: "Limites claros. Ex.: 'nunca prometer resultado garantido', 'não dar suporte técnico do produto por aqui'.",
    conclusao: "Ao concluir, sua IA fica ligada e começa a atender. Você ainda pode conectar suas plataformas de checkout e escrever a mensagem de entrega em Configurações → Integrações quando quiser.",
  },
};

const inputCls =
  "w-full rounded-md border border-borda bg-fundo px-3 py-2.5 text-sm text-texto outline-none transition-colors focus:border-marca";

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

export function OnboardingWizard({
  dados,
  playbookInicial = "servico_local",
}: {
  dados: OnboardingData;
  playbookInicial?: PlaybookCopy;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [playbook, setPlaybook] = useState<PlaybookCopy>(playbookInicial);
  const t = DICAS[playbook];

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
    // Salva o tipo de operação junto (best-effort: se a coluna não existir ainda,
    // segue mesmo assim — não trava o onboarding).
    await salvarPlaybook(playbook).catch(() => {});
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
        <button onClick={() => router.push("/painel")} className="py-2 text-xs text-texto-suave hover:text-texto">
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
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-borda">
          <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${((step + 1) / PASSOS.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-borda bg-superficie p-6 shadow-card sm:p-8">
        {/* PASSO 1 — Identidade */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-corpo text-xl font-bold text-texto">Bem-vindo à Lolze! 👋</h1>
              <p className="mt-1 text-sm text-texto-suave">{t.intro1}</p>
            </div>

            {/* Tipo de operação: define a linguagem e as telas do resto do app. */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-texto">Você trabalha com</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <OpcaoOperacao
                  ativa={playbook === "servico_local"}
                  onClick={() => setPlaybook("servico_local")}
                  icon={Store}
                  titulo="Negócio local / serviço"
                  desc="Loja, clínica, salão, prestador. Foco em atender e agendar."
                />
                <OpcaoOperacao
                  ativa={playbook === "infoproduto"}
                  onClick={() => setPlaybook("infoproduto")}
                  icon={GraduationCap}
                  titulo="Produtor de infoproduto"
                  desc="Curso, mentoria, ebook. Foco em vender e entregar."
                />
              </div>
            </div>

            <Campo label="Nome do negócio" valor={nomeNegocio} onChange={setNomeNegocio} />
            <Campo label="Endereço" valor={endereco} onChange={setEndereco} dica={t.enderecoDica} />
            <Campo label="Horário de funcionamento" valor={horario} onChange={setHorario} dica={t.horarioDica} />
          </div>
        )}

        {/* PASSO 2 — Persona */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="flex items-center gap-2 font-corpo text-xl font-bold text-texto">
                <Sparkles size={18} className="text-marca" /> Ensine a sua IA
              </h1>
              <p className="mt-1 text-sm text-texto-suave">{t.intro2}</p>
            </div>
            {playbook === "servico_local" && (
              <div className="flex flex-wrap gap-2">
                {PERSONA_TEMPLATES.map((tpl) => (
                  <button key={tpl.id} onClick={() => aplicarTemplate(tpl.id)} className="rounded-pill border border-borda bg-fundo-2 px-3 py-1.5 text-xs font-semibold text-texto transition-colors hover:border-marca hover:text-marca">
                    {tpl.nome}
                  </button>
                ))}
              </div>
            )}
            <Campo label="O que você oferece" valor={oferta} onChange={setOferta} textarea dica={t.oferta} />
            <Campo label="Público-alvo" valor={publico} onChange={setPublico} textarea dica={t.publico} />
            <Campo label="Tom de voz" valor={tom} onChange={setTom} textarea dica={t.tom} />
            <Campo label="Objeções comuns (e como responder)" valor={objecoes} onChange={setObjecoes} textarea dica={t.objecoes} />
            <Campo label="Perguntas frequentes" valor={faq} onChange={setFaq} textarea dica={t.faq} />
            <Campo label="Regras (o que a IA deve/não deve fazer)" valor={regras} onChange={setRegras} textarea dica={t.regras} />
          </div>
        )}

        {/* PASSO 3 — Base de conhecimento */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-corpo text-xl font-bold text-texto">Base de conhecimento</h1>
              <p className="mt-1 text-sm text-texto-suave">
                Suba documentos com seus serviços, preços, durações e regras. É o que deixa a IA precisa (e agenda melhor). Opcional, dá pra fazer depois.
              </p>
            </div>

            {/* Modelo pronto para o cliente preencher e subir */}
            <div className="rounded-lg border border-marca/30 bg-marca-suave/30 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-texto">
                <FileText size={16} className="text-marca" /> Não sabe o que escrever?
              </p>
              <p className="mt-1 text-xs text-texto-suave">
                Baixe nosso modelo, preencha com as informações do seu negócio e envie aqui. É o
                jeito mais rápido e completo de ensinar a IA.
              </p>
              <a
                href="/modelo-conhecimento-lolze.txt"
                download
                className={buttonClasses("primary", "md", "mt-3")}
              >
                <Download size={16} /> Baixar modelo (.txt)
              </a>
            </div>

            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={onArquivo} className="hidden" />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={subindo}>
              {subindo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {subindo ? "Indexando…" : "Enviar documento (PDF/TXT)"}
            </Button>
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
            <p className="mx-auto max-w-md text-sm text-texto-suave">{t.conclusao}</p>
          </div>
        )}

        {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}

        {/* Navegação */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)} className="-mx-2 flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-texto-suave hover:text-texto">
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
              <button onClick={() => setStep(3)} className="-mx-2 px-2 py-2 text-sm font-semibold text-texto-suave hover:text-texto">
                Pular
              </button>
              <BtnContinuar onClick={() => setStep(3)} />
            </div>
          )}
          {step === 3 && <BtnContinuar onClick={() => setStep(4)} rotulo="Continuar" />}
          {step === 4 && (
            <Button variant="verde" size="lg" onClick={concluir} disabled={salvando}>
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Concluir e ligar a IA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OpcaoOperacao({
  ativa,
  onClick,
  icon: Icon,
  titulo,
  desc,
}: {
  ativa: boolean;
  onClick: () => void;
  icon: typeof Store;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        ativa ? "border-marca bg-marca-suave/40" : "border-borda bg-fundo-2 hover:border-marca/50"
      }`}
    >
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${ativa ? "bg-marca text-bege-principal" : "bg-superficie text-texto-suave"}`}>
        <Icon size={17} />
      </span>
      <span>
        <span className="block text-sm font-bold text-texto">{titulo}</span>
        <span className="mt-0.5 block text-xs text-texto-suave">{desc}</span>
      </span>
    </button>
  );
}

function BtnContinuar({ onClick, loading, rotulo = "Salvar e continuar" }: { onClick: () => void; loading?: boolean; rotulo?: string }) {
  return (
    <Button variant="primary" onClick={onClick} disabled={loading}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
      {loading ? "Salvando…" : rotulo}
    </Button>
  );
}
