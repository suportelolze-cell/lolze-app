"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/tenant";
import { getCrmAdmin } from "@/lib/supabase/admin";
import { ingerir } from "./ingest";

const ehGestor = (papel: string) => papel === "owner" || papel === "superadmin";

async function exigirSuper() {
  const s = await getSessao();
  if (s.papel !== "superadmin") throw new Error("Acesso restrito.");
  return s;
}

async function extrairTexto(file: File): Promise<string> {
  const nome = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (nome.endsWith(".pdf")) {
    // pdf-parse v1: importa o módulo interno para evitar o bug do arquivo de teste.
    const { default: pdf } = await import("pdf-parse/lib/pdf-parse.js");
    const r = await pdf(buf);
    return r.text;
  }
  return buf.toString("utf8");
}

/** Extrai nome + texto de um upload (arquivo ou texto colado). Compartilhado. */
async function lerUpload(fd: FormData): Promise<{ nome: string; texto: string } | { erro: string }> {
  const file = fd.get("file") as File | null;
  const textoColado = ((fd.get("texto") as string | null) ?? "").trim();
  const nomeColado = ((fd.get("nome") as string | null) ?? "").trim();

  if (file && file.size > 0) {
    try {
      return { nome: file.name, texto: await extrairTexto(file) };
    } catch (e) {
      return { erro: "Não consegui ler o arquivo: " + (e as Error).message };
    }
  }
  if (textoColado) return { nome: nomeColado || "Texto colado", texto: textoColado };
  return { erro: "Envie um arquivo ou cole o texto." };
}

export type ResDoc = { ok: boolean; erro?: string; trechos?: number; nome?: string };

/** Sobe um documento (arquivo ou texto colado) para a base do cliente. (ADMIN) */
export async function subirDocumento(tenantId: string, fd: FormData): Promise<ResDoc> {
  await exigirSuper();
  const lido = await lerUpload(fd);
  if ("erro" in lido) return { ok: false, erro: lido.erro };
  if (!lido.texto.trim()) return { ok: false, erro: "Documento sem texto legível." };
  try {
    const trechos = await ingerir(tenantId, lido.nome, lido.texto);
    revalidatePath(`/admin/clientes/${tenantId}`);
    return { ok: true, trechos, nome: lido.nome };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Sobe um documento para a base da PRÓPRIA empresa (cliente/onboarding). */
export async function subirDocumentoCliente(fd: FormData): Promise<ResDoc> {
  const s = await getSessao();
  if (!ehGestor(s.papel) || !s.tenantId) return { ok: false, erro: "Sem permissão." };
  const lido = await lerUpload(fd);
  if ("erro" in lido) return { ok: false, erro: lido.erro };
  if (!lido.texto.trim()) return { ok: false, erro: "Documento sem texto legível." };
  try {
    const trechos = await ingerir(s.tenantId, lido.nome, lido.texto);
    revalidatePath("/onboarding");
    return { ok: true, trechos, nome: lido.nome };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Remove um documento (todos os trechos daquele arquivo) da base do cliente. */
export async function removerDocumento(tenantId: string, fileNome: string): Promise<ResDoc> {
  await exigirSuper();
  const admin = getCrmAdmin();
  const { error } = await admin
    .from("app_kb_documents")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("file_nome", fileNome);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/clientes/${tenantId}`);
  return { ok: true };
}
