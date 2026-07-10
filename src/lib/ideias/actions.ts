"use server";

import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { revalidatePath } from "next/cache";
import type { StatusIdeia } from "./data";

const STATUS_VALIDOS: StatusIdeia[] = ["analise", "aprovado", "execucao", "entregue", "recusado"];

type Admin = ReturnType<typeof getCrmAdmin>;

async function nomeDoUsuario(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from("app_profiles").select("nome").eq("id", userId).maybeSingle();
  return ((data?.nome as string | null) ?? "").trim() || "Cliente Lolze";
}

/** Cria uma nova ideia (qualquer usuário logado). Entra sempre em "análise". */
export async function criarIdeia(
  titulo: string,
  descricao: string
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!s.userId) return { ok: false, erro: "Faça login para sugerir." };
  const t = (titulo ?? "").trim();
  if (t.length < 3) return { ok: false, erro: "Dê um título um pouco mais descritivo." };

  const admin = getCrmAdmin();
  const nome = await nomeDoUsuario(admin, s.userId);
  const { error } = await admin.from("app_ideias").insert({
    titulo: t.slice(0, 140),
    descricao: (descricao ?? "").trim().slice(0, 2000),
    status: "analise",
    autor_id: s.userId,
    autor_nome: nome,
    tenant_id: s.tenantId,
  });
  if (error) return { ok: false, erro: "Não consegui salvar agora. Tente de novo." };
  revalidatePath("/ideias");
  return { ok: true };
}

/** Curtir/descurtir (1 por usuário). Retorna o novo estado. */
export async function curtirIdeia(ideiaId: string): Promise<{ ok: boolean; curtido?: boolean }> {
  const s = await getSessao();
  if (!s.userId) return { ok: false };
  const admin = getCrmAdmin();

  const { data: ja } = await admin
    .from("app_ideia_likes")
    .select("ideia_id")
    .eq("ideia_id", ideiaId)
    .eq("user_id", s.userId)
    .maybeSingle();

  if (ja) {
    await admin.from("app_ideia_likes").delete().eq("ideia_id", ideiaId).eq("user_id", s.userId);
    revalidatePath("/ideias");
    return { ok: true, curtido: false };
  }
  await admin.from("app_ideia_likes").insert({ ideia_id: ideiaId, user_id: s.userId });
  revalidatePath("/ideias");
  return { ok: true, curtido: true };
}

/** Comenta numa ideia (qualquer usuário logado). */
export async function comentarIdeia(
  ideiaId: string,
  texto: string
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!s.userId) return { ok: false, erro: "Faça login para comentar." };
  const txt = (texto ?? "").trim();
  if (!txt) return { ok: false, erro: "Escreva algo antes de enviar." };

  const admin = getCrmAdmin();
  const nome = await nomeDoUsuario(admin, s.userId);
  const { error } = await admin.from("app_ideia_comentarios").insert({
    ideia_id: ideiaId,
    user_id: s.userId,
    autor_nome: nome,
    texto: txt.slice(0, 1000),
  });
  if (error) return { ok: false, erro: "Não consegui comentar agora." };
  revalidatePath("/ideias");
  return { ok: true };
}

/** Muda a etapa da ideia — SOMENTE superadmin. */
export async function mudarStatusIdeia(
  ideiaId: string,
  status: StatusIdeia
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (s.papel !== "superadmin") return { ok: false, erro: "Sem permissão." };
  if (!STATUS_VALIDOS.includes(status)) return { ok: false, erro: "Status inválido." };
  const admin = getCrmAdmin();
  await admin
    .from("app_ideias")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ideiaId);
  revalidatePath("/ideias");
  return { ok: true };
}

export type Comentario = {
  id: string;
  autorNome: string;
  texto: string;
  createdAt: string;
  minha: boolean;
};

/** Lista os comentários de uma ideia (carregado sob demanda ao expandir). */
export async function listarComentarios(ideiaId: string): Promise<Comentario[]> {
  const s = await getSessao();
  const admin = getCrmAdmin();
  const { data } = await admin
    .from("app_ideia_comentarios")
    .select("id,autor_nome,texto,created_at,user_id")
    .eq("ideia_id", ideiaId)
    .order("created_at", { ascending: true });
  return (
    (data ?? []) as Array<{
      id: string;
      autor_nome: string | null;
      texto: string;
      created_at: string;
      user_id: string | null;
    }>
  ).map((r) => ({
    id: r.id,
    autorNome: (r.autor_nome ?? "").trim() || "Cliente",
    texto: r.texto,
    createdAt: r.created_at,
    minha: !!s.userId && r.user_id === s.userId,
  }));
}
