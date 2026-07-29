"use server";

import { revalidatePath } from "next/cache";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";
import { tipoDeMime, caminhoMidiaValido } from "@/lib/atendimento/midia-core";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

/** URL de upload assinada para um arquivo da biblioteca (sob o prefixo do tenant). */
export async function criarUploadBiblioteca(
  ext: string
): Promise<{ ok: boolean; path?: string; url?: string; token?: string; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const safeExt = (ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
  const path = `${s.tenantId}/biblioteca/${crypto.randomUUID()}.${safeExt}`;

  const admin = getCrmAdmin();
  const { data, error } = await admin.storage.from("midias").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, erro: error?.message ?? "Falha ao preparar o upload." };
  return { ok: true, path, url: data.signedUrl, token: data.token };
}

/** Cadastra um item na biblioteca (após o upload). Tipo derivado do MIME informado. */
export async function adicionarItemBiblioteca(input: {
  path: string;
  nome: string;
  quandoUsar: string;
  mime: string;
  filename: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  // Path estrito (barra traversal). Antes de qualquer limpeza, garante que é nosso.
  if (!caminhoMidiaValido(input.path, s.tenantId, "biblioteca")) {
    return { ok: false, erro: "Caminho inválido." };
  }

  const admin = getCrmAdmin();
  // Limpa o objeto já subido se o cadastro não completar (rollback server-side,
  // service_role — o client não tem policy de DELETE no bucket privado).
  const limparOrfao = () => admin.storage.from("midias").remove([input.path]).catch(() => {});

  const nome = input.nome.trim();
  if (!nome) {
    await limparOrfao();
    return { ok: false, erro: "Dê um nome ao arquivo." };
  }
  const mime = input.mime || "application/octet-stream";
  const tipo = tipoDeMime(mime);
  if (!tipo) {
    await limparOrfao();
    return { ok: false, erro: "Tipo de arquivo não suportado." };
  }

  const { error } = await admin.from("app_biblioteca_midia").insert({
    tenant_id: s.tenantId,
    nome,
    quando_usar: input.quandoUsar.trim(),
    tipo,
    path: input.path,
    mime,
    filename: input.filename,
    ativo: true,
  });
  if (error) {
    await limparOrfao();
    return { ok: false, erro: error.message };
  }
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Remove um item da biblioteca (linha do catálogo + arquivo no Storage se ninguém usa). */
export async function removerItemBiblioteca(id: string): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };

  const admin = getCrmAdmin();
  const { data: item } = await admin
    .from("app_biblioteca_midia")
    .select("path")
    .eq("id", id)
    .eq("tenant_id", s.tenantId)
    .maybeSingle();
  if (!item) return { ok: false, erro: "Arquivo não encontrado." };

  const { error } = await admin
    .from("app_biblioteca_midia")
    .delete()
    .eq("id", id)
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };

  // Só apaga o objeto do Storage se NENHUMA mensagem já enviada aponta para ele
  // (o path é compartilhado: remover destruiria a mídia de conversas passadas).
  if (item.path) {
    const { data: usada } = await admin
      .from("app_mensagens")
      .select("id")
      .eq("tenant_id", s.tenantId)
      .eq("midia_url", item.path as string)
      .limit(1);
    if (!usada || usada.length === 0) {
      await admin.storage.from("midias").remove([item.path as string]).catch(() => {});
    }
  }
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Liga/desliga um item (sem apagar). */
export async function alternarItemBiblioteca(
  id: string,
  ativo: boolean
): Promise<{ ok: boolean; erro?: string }> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_biblioteca_midia")
    .update({ ativo })
    .eq("id", id)
    .eq("tenant_id", s.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}
