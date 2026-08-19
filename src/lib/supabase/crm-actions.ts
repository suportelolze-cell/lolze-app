"use server";

import { revalidatePath } from "next/cache";
import { getCrmServer } from "./server";
import { getCrmAdmin } from "./admin";
import { getSessao, getTenantId } from "./tenant";
import { getConversas } from "./crm-data";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { registrarEvento } from "@/lib/eventos";
import { mesclarLeads } from "@/lib/identidade";
import { urlsAssinadasMidia } from "@/lib/evolution/client";
import { enfileirarPosVenda } from "@/lib/agent/followup-cadencia";
import type { ColunaId } from "@/lib/leads";

type CrmServer = Awaited<ReturnType<typeof getCrmServer>>;

/**
 * Matricula um cliente que acabou de virar 'ganho' na trilha de PÓS-VENDA
 * (acompanhamento recorrente automático). Não reinicia se já está na trilha
 * (evita duplicar o 1º toque quando 'ganho' é setado de novo).
 */
async function matricularPosVenda(
  sb: CrmServer,
  tenantId: string,
  leadId: number,
  modoAtual: string | null
): Promise<void> {
  if (modoAtual === "posvenda") return;
  const pv = enfileirarPosVenda();
  await sb
    .from("app_leads")
    .update({ proximo_followup: pv.proximo, followup_modo: pv.modo, followup_count: pv.count })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
}
import type { Conversa, Mensagem } from "@/lib/conversas";

/** Recarrega as conversas do tenant (usado pelo chat ao vivo). */
export async function recarregarConversas(): Promise<Conversa[]> {
  return getConversas();
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Histórico COMPLETO de uma conversa (todas as mensagens do lead), carregado sob
 * demanda ao abrir a conversa — o getConversas só embute as últimas 40 por lead.
 * Escopado ao tenant da sessão (RLS + filtro explícito).
 */
export async function carregarHistoricoConversa(leadId: number): Promise<Mensagem[]> {
  const s = await getSessao();
  if (!s.tenantId) return [];
  const sb = await getCrmServer();
  const { data, error } = await sb
    .from("app_mensagens")
    .select("id,autor,texto,created_at,midia_url,midia_tipo,status")
    .eq("tenant_id", s.tenantId)
    .eq("lead_id", leadId)
    .order("id", { ascending: true });
  // Distingue falha de leitura de "sem mensagens" (o cliente sinaliza o erro).
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as {
    id: number;
    autor: "ia" | "lead" | "atendente";
    texto: string;
    created_at: string;
    midia_url: string | null;
    midia_tipo: string | null;
    status: string | null;
  }[];

  const caminhos = linhas.map((m) => m.midia_url).filter((p): p is string => Boolean(p));
  const urlPorCaminho = await urlsAssinadasMidia(caminhos);

  return linhas.map((m) => ({
    id: m.id,
    autor: m.autor,
    texto: m.texto,
    hora: hhmm(m.created_at),
    midiaUrl: m.midia_url ? urlPorCaminho.get(m.midia_url) ?? null : null,
    midiaTipo: (m.midia_tipo as Mensagem["midiaTipo"]) ?? null,
    status: (m.status as Mensagem["status"]) ?? null,
  }));
}

/** Gera um CSV (separador ";", amigável ao Excel BR) com os leads do tenant. */
export async function exportarLeadsCsv(canal?: string): Promise<string> {
  const tid = await getTenantId();
  if (!tid) return "";
  const sb = await getCrmServer();
  let q = sb
    .from("app_leads")
    .select("nome,telefone,email,canal,origem,aquisicao,anuncio,temperatura,coluna,valor,created_at")
    .eq("tenant_id", tid);
  if (canal && canal !== "todos") q = q.eq("canal", canal);
  const { data } = await q.order("created_at", { ascending: false });

  const cols = [
    "nome",
    "telefone",
    "email",
    "canal",
    "origem",
    "aquisicao",
    "anuncio",
    "temperatura",
    "coluna",
    "valor",
    "created_at",
  ] as const;
  const titulos = [
    "Nome",
    "Telefone",
    "E-mail",
    "Canal",
    "Origem",
    "Aquisição",
    "Anúncio",
    "Temperatura",
    "Etapa",
    "Valor",
    "Criado em",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const linhas = (data ?? []).map((r) =>
    cols.map((c) => esc((r as Record<string, unknown>)[c])).join(";")
  );
  return [titulos.join(";"), ...linhas].join("\n");
}

/** Salva as respostas rápidas do tenant (uma por linha). Só gestor. */
export async function salvarRespostasRapidas(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return { ok: false, erro: "Sem permissão." };
  const tid = s.tenantId;
  if (!tid) return { ok: false, erro: "Sem empresa ativa." };
  const sb = await getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({ respostas_rapidas: texto, updated_at: new Date().toISOString() })
    .eq("tenant_id", tid);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** Liga/desliga a IA por completo (master switch — não responde ninguém quando off). */
export async function setIaAtiva(ativo: boolean): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const sb = await getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({ agente_ativo: ativo, updated_at: new Date().toISOString() })
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  const { registrarAuditoria } = await import("@/lib/admin/auditoria");
  await registrarAuditoria({ acao: ativo ? "ia.reativada" : "ia.pausada", tenantId: s.tenantId });
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Reativa um cliente da base com a IA (manda um toque de reativação na hora). */
export async function reativarClienteIA(leadId: number): Promise<{ ok: boolean; erro?: string }> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sem empresa ativa." };
  try {
    const { enviarFollowup } = await import("@/lib/agent/followup");
    await enviarFollowup(tid, leadId);
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
  await registrarEvento({ tenantId: tid, leadId, tipo: "lead_reactivated", dados: { modo: "manual" } });
  revalidatePath("/contatos");
  return { ok: true };
}

/** Salva o número do especialista + horário de atendimento (abre/fecha) do tenant. Só gestor. */
export async function salvarAtendimentoCfg(input: {
  especialista: string;
  abre: number;
  fecha: number;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return { ok: false, erro: "Sem permissão." };
  const tid = s.tenantId;
  if (!tid) return { ok: false, erro: "Sem empresa ativa." };
  const abre = Math.min(Math.max(Math.round(Number(input.abre) || 8), 0), 23);
  const fecha = Math.min(Math.max(Math.round(Number(input.fecha) || 18), abre + 1), 24);
  const sb = await getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({
      especialista_numero: input.especialista.trim() || null,
      agenda_abre: abre,
      agenda_fecha: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** Cadastra um lead manualmente (botão "Adicionar Lead" do painel/pipeline). */
export async function criarLeadManual(input: {
  nome: string;
  telefone?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const tid = await getTenantId();
  if (!tid) return { ok: false, erro: "Sem empresa ativa." };
  const nome = input.nome.trim();
  if (!nome) return { ok: false, erro: "Informe o nome do lead." };
  const admin = getCrmAdmin();
  const { data: novo, error } = await admin
    .from("app_leads")
    .insert({
      tenant_id: tid,
      nome,
      telefone: input.telefone?.trim() || null,
      temperatura: "morno",
      coluna: "entrada",
      canal: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message };
  await registrarEvento({
    tenantId: tid,
    leadId: (novo?.id as number | undefined) ?? null,
    tipo: "lead_received",
    canal: "manual",
    origem: "site",
  });
  revalidatePath("/pipeline");
  revalidatePath("/painel");
  return { ok: true };
}

/** Move um card de coluna (Pipeline). */
export async function moverLead(id: number, coluna: ColunaId) {
  const tid = await getTenantId();
  const sb = await getCrmServer();

  // Estado ANTES do move — o gatilho de pós-venda só dispara na TRANSIÇÃO para
  // 'ganho' (não re-enfileira quem já era ganho nem reinicia uma trilha encerrada).
  let prevColuna: string | null = null;
  let prevModo: string | null = null;
  if (coluna === "ganho") {
    const fPrev = sb.from("app_leads").select("coluna,followup_modo").eq("id", id);
    const { data: prev } = await (tid ? fPrev.eq("tenant_id", tid) : fPrev).maybeSingle();
    prevColuna = (prev?.coluna as string | null) ?? null;
    prevModo = (prev?.followup_modo as string | null) ?? null;
  }

  // Voltar para uma etapa da IA reativa o agente (tira do modo humano).
  const reativaIA = coluna === "qualificacao" || coluna === "entrada";
  const patch: Record<string, unknown> = { coluna };
  if (reativaIA) {
    patch.comando = "ia";
    patch.precisa_humano = false;
    patch.atendente_id = null;
  }

  const q = sb.from("app_leads").update(patch).eq("id", id);
  const { error } = await (tid ? q.eq("tenant_id", tid) : q);
  if (error) throw error;

  // Ledger: qualificação/venda registradas como fato (one-shot deduplica).
  if (tid && coluna === "qualificacao") {
    await registrarEvento({ tenantId: tid, leadId: id, tipo: "qualified", dados: { por: "humano" } });
  }
  if (tid && coluna === "ganho") {
    const { data: l } = await sb
      .from("app_leads")
      .select("valor,canal,origem")
      .eq("id", id)
      .maybeSingle();
    await registrarEvento({
      tenantId: tid,
      leadId: id,
      tipo: "sale_won",
      canal: (l?.canal as string | null) ?? null,
      origem: (l?.origem as string | null) ?? null,
      valorCents: l?.valor != null ? Math.round(Number(l.valor) * 100) : null,
    });
    // Entra na trilha de pós-venda SÓ quando ENTRA em 'ganho' (transição).
    if (prevColuna !== "ganho") {
      await matricularPosVenda(sb, tid, id, prevModo);
    }
  }

  // Se reativou a IA e há uma mensagem do lead sem resposta, faz a IA já responder.
  if (reativaIA && tid) {
    const { data: ult } = await sb
      .from("app_mensagens")
      .select("autor")
      .eq("lead_id", id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ult?.autor === "lead") {
      const { executarSDR } = await import("@/lib/agent/sdr/run");
      await executarSDR(tid, id).catch(() => {});
    }
  }

  // Mantém painel/pipeline em dia (contagens por etapa) — como confirmarReceita.
  revalidatePath("/pipeline");
  revalidatePath("/painel");
}

export type ResAssumir = { ok: boolean; erro?: string; atendenteId?: string };

/**
 * Assume a conversa (trava para os outros). Só consegue se estiver livre (IA)
 * ou já for sua. O gestor (dono/superadmin) pode forçar a tomada.
 */
export async function assumirConversa(id: number): Promise<ResAssumir> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };
  const sb = await getCrmServer();

  let q = sb
    .from("app_leads")
    .update({
      comando: "humano",
      precisa_humano: false,
      atendente_id: s.userId,
      ultimo_atendente_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);

  // SDR comum: só pega se estiver livre ou já for dele. Gestor força.
  if (!ehGestor(s.papel)) {
    q = q.or(`atendente_id.is.null,atendente_id.eq.${s.userId}`);
  }

  const { data, error } = await q.select("id");
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) {
    return { ok: false, erro: "Esta conversa já está sendo atendida por outro membro." };
  }
  await registrarEvento({
    tenantId: s.tenantId,
    leadId: id,
    tipo: "handoff_requested",
    dados: { por: "humano" },
  });
  return { ok: true, atendenteId: s.userId };
}

/** Devolve a conversa para a IA (libera a trava). */
export async function devolverConversa(id: number) {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) throw new Error("Sessão inválida.");
  const sb = await getCrmServer();

  let q = sb
    .from("app_leads")
    .update({ comando: "ia", atendente_id: null })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);

  // SDR comum só devolve a própria; gestor devolve qualquer uma.
  if (!ehGestor(s.papel)) q = q.eq("atendente_id", s.userId);

  const { error } = await q;
  if (error) throw error;
}

export type ResEnviar = { ok: boolean; erro?: string; aviso?: string };

/** Envia mensagem. Só quem detém a trava da conversa pode escrever. */
export async function enviarMensagem(leadId: number, texto: string): Promise<ResEnviar> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };
  const sb = await getCrmServer();

  // Renova a trava e confirma que ela é minha (atomicamente).
  const { data: dono, error: errLock } = await sb
    .from("app_leads")
    .update({ ultimo_atendente_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .eq("atendente_id", s.userId)
    .select("id");
  if (errLock) return { ok: false, erro: errLock.message };
  if (!dono || dono.length === 0) {
    return { ok: false, erro: "Você não está com esta conversa. Assuma antes de responder." };
  }

  const { data: msgRow, error } = await sb
    .from("app_mensagens")
    .insert({ lead_id: leadId, autor: "atendente", texto, tenant_id: s.tenantId })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message };

  // Entrega ao canal com status/retentativa (a falha fica visível na conversa).
  const entrega = await dispatchOutbound(
    s.tenantId,
    leadId,
    texto,
    (msgRow?.id as number | undefined) ?? undefined
  );
  // Ledger: primeira resposta do sistema — só conta se REALMENTE entregou (não
  // marcar first_response quando o canal falhou e o lead não recebeu nada).
  if (entrega.ok) {
    await registrarEvento({
      tenantId: s.tenantId,
      leadId,
      tipo: "first_response_sent",
      canal: entrega.canal ?? null,
      dados: { autor: "atendente" },
    });
  }
  if (!entrega.ok && entrega.canal !== "painel") {
    return {
      ok: true,
      aviso: "A mensagem foi salva, mas a entrega no canal falhou. Verifique a conexão do canal em Configurações.",
    };
  }
  return { ok: true };
}

/**
 * Confirma a venda com valor: fixa o valor do negócio, move para "ganho" e
 * registra sale_won + revenue_confirmed no ledger (receita confirmada = fato
 * que alimenta a atribuição de receita em Resultados).
 */
export async function confirmarReceita(
  leadId: number,
  valorReais: number
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!s.tenantId) return { ok: false, erro: "Sem empresa ativa." };
  const valor = Math.max(0, Math.round(Number(valorReais) * 100) / 100);
  const sb = await getCrmServer();
  // Estado ANTES (para matricular pós-venda só na TRANSIÇÃO para 'ganho' — não
  // re-enfileira ao reajustar o valor de um negócio que já era ganho).
  const { data: prev } = await sb
    .from("app_leads")
    .select("coluna,followup_modo")
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .maybeSingle();
  const prevColuna = (prev?.coluna as string | null) ?? null;
  const prevModo = (prev?.followup_modo as string | null) ?? null;

  const { data: l, error } = await sb
    .from("app_leads")
    .update({ valor, coluna: "ganho", updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .select("canal,origem")
    .single();
  if (error) return { ok: false, erro: error.message };

  const cents = Math.round(valor * 100);
  const canal = (l?.canal as string | null) ?? null;
  const origem = (l?.origem as string | null) ?? null;
  // sale_won é one-shot (dedup no ledger); revenue_confirmed carrega o valor.
  await registrarEvento({ tenantId: s.tenantId, leadId, tipo: "sale_won", canal, origem, valorCents: cents });
  await registrarEvento({
    tenantId: s.tenantId,
    leadId,
    tipo: "revenue_confirmed",
    canal,
    origem,
    valorCents: cents,
  });
  // Entra na trilha de pós-venda SÓ quando ENTRA em 'ganho' (transição).
  if (prevColuna !== "ganho") {
    await matricularPosVenda(sb, s.tenantId, leadId, prevModo);
  }

  revalidatePath("/pipeline");
  revalidatePath("/atendimento");
  revalidatePath("/painel");
  return { ok: true };
}

export type Duplicado = { id: number; nome: string; canal: string; telefone: string };

/**
 * Candidatos a mesmo humano em outra ficha: mesmo telefone ou mesmo nome
 * (ex.: a pessoa do Instagram que também escreveu no WhatsApp).
 */
export async function buscarDuplicados(leadId: number): Promise<Duplicado[]> {
  const s = await getSessao();
  if (!s.tenantId) return [];
  const admin = getCrmAdmin();

  const { data: eu } = await admin
    .from("app_leads")
    .select("nome,telefone")
    .eq("tenant_id", s.tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (!eu) return [];

  const tel = (eu.telefone ?? "").trim();
  const nome = (eu.nome ?? "").trim();
  if (!tel && !nome) return [];

  // Duas queries PARAMETRIZADAS (nunca interpolar no .or(): vírgula/parênteses no
  // nome quebram o filtro e permitem injeção). % e _ escapados para não virarem
  // curinga do ILIKE.
  const base = () =>
    admin.from("app_leads").select("id,nome,canal,telefone").eq("tenant_id", s.tenantId).neq("id", leadId).limit(5);
  const buscas: PromiseLike<{ data: unknown }>[] = [];
  if (tel) buscas.push(base().eq("telefone", tel));
  if (nome) buscas.push(base().ilike("nome", nome.replace(/[%_\\]/g, "\\$&")));

  const partes = await Promise.all(buscas);
  const mapa = new Map<number, { id: number; nome: string; canal: string | null; telefone: string | null }>();
  for (const r of partes) {
    for (const d of (r.data ?? []) as { id: number; nome: string; canal: string | null; telefone: string | null }[]) {
      mapa.set(d.id, d);
    }
  }
  return Array.from(mapa.values())
    .slice(0, 5)
    .map((d) => ({ id: d.id, nome: d.nome, canal: d.canal ?? "—", telefone: d.telefone ?? "" }));
}

/**
 * Unifica dois contatos ("um cliente, uma memória"): o histórico do absorvido
 * vem para a conversa aberta e a ficha duplicada some. Só gestor.
 */
export async function mesclarConversas(
  principalId: number,
  absorvidoId: number
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel)) return { ok: false, erro: "Sem permissão (apenas o gestor unifica contatos)." };
  if (!s.tenantId) return { ok: false, erro: "Sem empresa ativa." };
  const r = await mesclarLeads(s.tenantId, principalId, absorvidoId);
  if (r.ok) {
    revalidatePath("/atendimento");
    revalidatePath("/pipeline");
    revalidatePath("/contatos");
  }
  return r;
}

/** Configurações: salvar identidade do negócio + persona do agente (do tenant ativo). */
export async function salvarConfig(c: {
  nomeNegocio: string;
  endereco: string;
  email: string;
  horario: string;
  oferta: string;
  publico: string;
  tom: string;
  objecoes: string;
  faq: string;
  regras: string;
  agenteAtivo: boolean;
}) {
  const s = await getSessao();
  if (!ehGestor(s.papel)) throw new Error("Sem permissão.");
  const tid = s.tenantId;
  if (!tid) throw new Error("Sem tenant ativo.");
  const sb = await getCrmServer();
  const { error } = await sb
    .from("app_config")
    .update({
      nome_negocio: c.nomeNegocio,
      endereco: c.endereco,
      email: c.email,
      horario: c.horario,
      oferta: c.oferta,
      publico: c.publico,
      tom: c.tom,
      objecoes: c.objecoes,
      faq: c.faq,
      regras: c.regras,
      agente_ativo: c.agenteAtivo,
    })
    .eq("tenant_id", tid);
  if (error) throw error;
}
