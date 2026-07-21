import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sunrise,
  AlertTriangle,
  Flame,
  HandHelping,
  CalendarClock,
  Repeat,
  Bot,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getHoje } from "@/lib/hoje";
import { getPerfil } from "@/lib/supabase/crm-data";
import { getSessao } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function HojePage() {
  const sessao = await getSessao();
  if (sessao.papel === "superadmin" && !sessao.impersonating) redirect("/admin");

  const [d, perfil] = await Promise.all([getHoje(), getPerfil()]);

  const dataLonga = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const totalAcoes =
    d.falhas.length + d.handoffPendente.length + d.quentesSemResposta.length + d.reativar.length;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-texto-suave">
            <Sunrise size={16} className="text-marca" /> {dataLonga}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium italic tracking-tight text-texto">
            Hoje, {perfil.nome || "bem-vindo"}
          </h1>
          <p className="mt-1 text-sm text-texto-suave">
            {totalAcoes === 0
              ? "Tudo em dia — nenhuma ação pendente. ✨"
              : `${totalAcoes} ${totalAcoes === 1 ? "item precisa" : "itens precisam"} da sua atenção${
                  d.valorEmAcao > 0 ? ` — ${brl(d.valorEmAcao)} em jogo` : ""
                }.`}
          </p>
        </div>
      </header>

      {/* Saúde dos canais e do agente */}
      <section className="mb-8 flex flex-wrap gap-2">
        <ChipSaude ok={d.saude.agenteAtivo} okTexto="IA respondendo" falhaTexto="IA DESLIGADA" />
        <ChipSaude
          ok={d.saude.whatsappConectado}
          okTexto={d.saude.whatsappOficial ? "WhatsApp (API oficial)" : "WhatsApp conectado"}
          falhaTexto="WhatsApp desconectado"
        />
        {d.saude.instagramConfigurado && (
          <ChipSaude ok okTexto="Instagram configurado" falhaTexto="" />
        )}
        <ChipSaude
          ok={d.saude.googleConectado}
          okTexto="Agenda Google sincronizada"
          falhaTexto="Agenda Google desconectada"
        />
        <ChipSaude
          ok={d.saude.errosAltos24h === 0}
          okTexto="Sem erros críticos (24h)"
          falhaTexto={`${d.saude.errosAltos24h} erro(s) crítico(s) em 24h`}
        />
        <span className="flex items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto-suave">
          <Bot size={13} /> {d.saude.chamadasIAHoje} respostas da IA hoje
        </span>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          icone={AlertTriangle}
          titulo="Mensagens que falharam"
          tom="critico"
          vazio="Nenhuma falha de entrega nas últimas 48h."
          itens={d.falhas.map((f) => ({
            chave: `f${f.leadId}-${f.quandoISO}`,
            href: `/atendimento?conversa=${f.leadId}`,
            titulo: f.nome,
            detalhe: `"${f.texto}"`,
            acao: "Reenviar / verificar canal",
          }))}
        />

        <Secao
          icone={HandHelping}
          titulo="A IA pediu ajuda (handoff)"
          tom="critico"
          vazio="Nenhuma conversa esperando um humano."
          itens={d.handoffPendente.map((h) => ({
            chave: `h${h.leadId}`,
            href: `/atendimento?conversa=${h.leadId}`,
            titulo: h.nome + (h.valor ? ` · ${brl(Number(h.valor))}` : ""),
            detalhe: h.horasParado > 0 ? `Parado há ${h.horasParado}h` : "Agora há pouco",
            acao: "Assumir conversa",
          }))}
        />

        <Secao
          icone={Flame}
          titulo="Leads quentes aguardando resposta"
          tom="alerta"
          vazio="Nenhum lead quente sem resposta."
          itens={d.quentesSemResposta.map((q) => ({
            chave: `q${q.leadId}`,
            href: `/atendimento?conversa=${q.leadId}`,
            titulo: q.nome + (q.valor ? ` · ${brl(Number(q.valor))}` : ""),
            detalhe: q.horasParado > 0 ? `Esperando há ${q.horasParado}h` : "Agora há pouco",
            acao: "Responder agora",
          }))}
        />

        <Secao
          icone={CalendarClock}
          titulo="Agenda das próximas 24h"
          tom="neutro"
          vazio="Nenhum compromisso nas próximas 24 horas."
          itens={d.agenda24h.map((a) => ({
            chave: `a${a.id}`,
            href: "/agenda",
            titulo: `${hhmm(a.inicioISO)} — ${a.nome}`,
            detalhe: a.servico,
            acao: a.lembreteEnviado ? "Lembrete enviado ✓" : "Lembrete ainda não enviado",
          }))}
        />

        <Secao
          icone={Repeat}
          titulo="Prontos para reativar"
          tom="neutro"
          vazio="Nenhum cliente da base sumido além do padrão."
          itens={d.reativar.map((r) => ({
            chave: `r${r.leadId}`,
            href: "/recorrencia",
            titulo: r.nome,
            detalhe:
              r.diasDesdeUltimo != null
                ? `Sem retorno há ${r.diasDesdeUltimo} dias`
                : "Fora da cadência habitual",
            acao: "Reativar com a IA",
          }))}
        />
      </div>
    </>
  );
}

function ChipSaude({ ok, okTexto, falhaTexto }: { ok: boolean; okTexto: string; falhaTexto: string }) {
  if (ok) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto-suave">
        <CheckCircle2 size={13} className="text-marca" /> {okTexto}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
      <XCircle size={13} /> {falhaTexto}
    </span>
  );
}

function Secao({
  icone: Icone,
  titulo,
  tom,
  vazio,
  itens,
}: {
  icone: LucideIcon;
  titulo: string;
  tom: "critico" | "alerta" | "neutro";
  vazio: string;
  itens: { chave: string; href: string; titulo: string; detalhe: string; acao: string }[];
}) {
  const corIcone =
    tom === "critico" ? "text-red-600" : tom === "alerta" ? "text-amber-600" : "text-marca";
  return (
    <section className="rounded-xl border border-borda bg-superficie p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-corpo text-lg font-bold text-texto">
          <Icone size={18} className={corIcone} /> {titulo}
        </h2>
        {itens.length > 0 && (
          <span className="rounded-full bg-fundo px-2.5 py-0.5 text-xs font-bold text-texto-suave">
            {itens.length}
          </span>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-texto-suave">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.chave}>
              <Link
                href={i.href}
                className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-fundo px-4 py-3 transition-colors hover:border-marca"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-texto">{i.titulo}</p>
                  <p className="truncate text-xs text-texto-suave">{i.detalhe}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-marca">{i.acao} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
