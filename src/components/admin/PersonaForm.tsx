"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Check, Sparkles } from "lucide-react";
import { salvarPersona } from "@/lib/admin/actions";
import type { Persona } from "@/lib/admin/data";
import { PERSONA_TEMPLATES } from "@/lib/admin/persona-templates";

const inputCls =
  "w-full rounded-lg border border-borda bg-fundo px-4 py-2.5 text-sm text-texto outline-none focus:border-marca";

export function PersonaForm({ tenantId, persona }: { tenantId: string; persona: Persona }) {
  const router = useRouter();
  const [p, setP] = useState<Persona>(persona);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const set = (k: keyof Persona) => (v: string) => setP((s) => ({ ...s, [k]: v }));

  function aplicarTemplate(id: string) {
    const t = PERSONA_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const temConteudo = [p.oferta, p.publico, p.tom, p.objecoes, p.faq, p.regras].some((v) => v.trim());
    if (temConteudo && !confirm("Isto vai substituir os campos atuais pelo template. Continuar?")) return;
    setP((s) => ({
      ...s,
      oferta: t.oferta,
      publico: t.publico,
      tom: t.tom,
      objecoes: t.objecoes,
      faq: t.faq,
      regras: t.regras,
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    setSalvo(false);
    try {
      await salvarPersona(tenantId, p);
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
        <Bot size={18} className="text-marca" />
        <h2 className="font-corpo text-lg font-bold text-texto">Cérebro do SDR (Persona da IA)</h2>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        O roteiro que a IA usa para atender, qualificar e quebrar objeções deste cliente. Quanto
        mais específico, mais afiada a venda.
      </p>

      {/* Atendimento automático */}
      <div className="mt-5 flex items-center justify-between rounded-lg border border-borda bg-fundo px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-texto">Atendimento automático</p>
          <p className="text-xs text-texto-suave">
            {p.agenteAtivo
              ? "A IA está atendendo os leads que chegam."
              : "Desligado — a IA não responde (só manual)."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setP((s) => ({ ...s, agenteAtivo: !s.agenteAtivo }))}
          aria-pressed={p.agenteAtivo}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            p.agenteAtivo ? "bg-marca" : "bg-borda"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              p.agenteAtivo ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Template por nicho (preenche os campos pra acelerar o onboarding) */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-borda bg-fundo px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-texto">
          <Sparkles size={15} className="text-marca" /> Template por nicho
        </span>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) aplicarTemplate(e.target.value);
            e.target.value = "";
          }}
          className="rounded-md border border-borda bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus:border-marca"
        >
          <option value="">Escolher e preencher…</option>
          {PERSONA_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <span className="text-xs text-texto-suave">Preenche os campos abaixo; depois é só ajustar.</span>
      </div>

      <div className="mt-4 space-y-4">
        <Campo
          label="Oferta principal"
          micro="A IA conecta a dor do lead ao serviço. Não inclua preços que não quer que ela cite."
          valor={p.oferta}
          onChange={set("oferta")}
          placeholder="O que vende, para quem, e o principal benefício."
        />
        <Campo
          label="Público-alvo"
          valor={p.publico}
          onChange={set("publico")}
          placeholder="Quem é o cliente ideal e o que costuma buscar."
        />
        <Campo
          label="Tom de voz"
          valor={p.tom}
          onChange={set("tom")}
          placeholder="Como a IA deve soar (ex.: acolhedora, consultiva, trata por você, sem gírias)."
        />
        <Campo
          label="Objeções comuns e como responder"
          micro="Uma objeção por linha, com a resposta que converte."
          valor={p.objecoes}
          onChange={set("objecoes")}
          rows={4}
          placeholder={'"Está caro" → mostrar valor e parcelamento.'}
        />
        <Campo
          label="Perguntas frequentes"
          valor={p.faq}
          onChange={set("faq")}
          rows={4}
          placeholder={"Onde fica? → Endereço.\nQuanto tempo dura? → ..."}
        />
        <Campo
          label="Regras e limites (o que NÃO fazer)"
          micro="Guardrails. A IA já é proibida de inventar preço ou promessa garantida."
          valor={p.regras}
          onChange={set("regras")}
          placeholder="Ex.: nunca prometer resultado garantido; nunca passar preço do procedimento X."
        />
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 rounded-sm bg-marca px-6 py-2.5 text-sm font-bold text-bege-principal transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
          Salvar cérebro do SDR
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

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  micro,
  rows = 3,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  micro?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-texto">{label}</span>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={inputCls}
      />
      {micro && <p className="mt-1 text-xs text-texto-suave">{micro}</p>}
    </label>
  );
}
