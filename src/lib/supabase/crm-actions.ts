"use server";

import { revalidatePath } from "next/cache";
import { getCrmServer } from "./server";
import { getCrmAdmin } from "./admin";
import { getSessao, getTenantId } from "./tenant";
import { getConversas } from "./crm-data";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { registrarEvento } from "@/lib/eventos";
import { mesclarLeads } from "@/lib/identidade";
import type { ColunaId } from "@/lib/leads";
import type { Conversa } from "@/lib/conversas";

/** Recarrega as conversas do tenant (usado pelo chat ao vivo). */
export async function recarregarConversas(): Promise<Conversa[]> {
  return getConversas();
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
  revalidatePath("/recorrencia");
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
    const { data: l } = await sb.from("app_leads").select("valor,canal,origem").eq("id", id).maybeSingle();
    await registrarEvento({
      tenantId: tid,
      leadId: id,
      tipo: "sale_won",
      canal: (l?.canal as string | null) ?? null,
      origem: (l?.origem as string | null) ?? null,
      valorCents: l?.valor != null ? Math.round(Number(l.valor) * 100) : null,
    });
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
  // Ledger: primeira resposta do sistema (se a IA já respondeu antes, o
  // one-shot ignora esta gravação).
  await registrarEvento({
    tenantId: s.tenantId,
    leadId,
    tipo: "first_response_sent",
    canal: entrega.canal ?? null,
    dados: { autor: "atendente" },
  });
  if (!entrega.ok && entrega.canal !== "painel") {
    return {
      ok: true,
      aviso: "A mensagem foi salva, mas a entrega no canal falhou. Verifique a conexão do canal em Configurações.",
    };
  }
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

  let q = admin
    .from("app_leads")
    .select("id,nome,canal,telefone")
    .eq("tenant_id", s.tenantId)
    .neq("id", leadId)
    .limit(5);
  const tel = (eu.telefone ?? "").trim();
  const nome = (eu.nome ?? "").trim();
  if (tel && nome) q = q.or(`telefone.eq.${tel},nome.ilike.${nome}`);
  else if (tel) q = q.eq("telefone", tel);
  else if (nome) q = q.ilike("nome", nome);
  else return [];

  const { data } = await q;
  return ((data ?? []) as { id: number; nome: string; canal: string | null; telefone: string | null }[]).map(
    (d) => ({ id: d.id, nome: d.nome, canal: d.canal ?? "—", telefone: d.telefone ?? "" })
  );
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
