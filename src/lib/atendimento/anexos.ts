"use server";

import { getCrmAdmin } from "@/lib/supabase/admin";
import { getCrmServer } from "@/lib/supabase/server";
import { getSessao } from "@/lib/supabase/tenant";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { registrarEvento } from "@/lib/eventos";
import { tipoCanal, tipoDeMime } from "./midia-core";

/**
 * Anexos no atendimento: o atendente humano envia imagem/vídeo/áudio/documento
 * na conversa. O arquivo sobe direto pro Storage (URL de upload assinada, sem
 * passar pelo servidor), e a mensagem é entregue no canal como mídia.
 */

/**
 * Prepara uma URL de upload assinada no bucket 'midias', sob o prefixo do
 * tenant. Só quem DETÉM a conversa pode gerar (reduz abuso de storage).
 */
export async function criarUploadAnexo(
  leadId: number,
  ext: string
): Promise<{ ok: boolean; path?: string; url?: string; token?: string; erro?: string }> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };

  const sb = await getCrmServer();
  const { data: dono } = await sb
    .from("app_leads")
    .select("id")
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .eq("atendente_id", s.userId)
    .maybeSingle();
  if (!dono) return { ok: false, erro: "Assuma a conversa antes de anexar." };

  const safeExt = (ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
  const path = `${s.tenantId}/atendente/${crypto.randomUUID()}.${safeExt}`;

  const admin = getCrmAdmin();
  const { data, error } = await admin.storage.from("midias").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, erro: error?.message ?? "Falha ao preparar o upload." };
  return { ok: true, path, url: data.signedUrl, token: data.token };
}

/**
 * Registra e entrega o anexo. Confirma a trava da conversa (como enviarMensagem)
 * e que o caminho é um anexo do próprio tenant. O TIPO é derivado do MIME no
 * servidor (não confia no cliente). Gera uma URL de leitura assinada para o
 * canal buscar o arquivo.
 */
export async function enviarAnexo(
  leadId: number,
  path: string,
  mime: string,
  filename: string,
  caption?: string
): Promise<{ ok: boolean; erro?: string; aviso?: string }> {
  const s = await getSessao();
  if (!s.userId || !s.tenantId) return { ok: false, erro: "Sessão inválida." };
  // Segurança: só anexos do próprio tenant (prefixo exato, não só o tenant).
  if (!path.startsWith(`${s.tenantId}/atendente/`)) return { ok: false, erro: "Caminho inválido." };

  // Tipo definido pelo servidor a partir do MIME (não confia no cliente).
  const tipo = tipoDeMime(mime);
  if (!tipo) return { ok: false, erro: "Tipo de arquivo não suportado." };

  const sb = await getCrmServer();

  // Renova/confirma a trava atomicamente — só quem detém a conversa envia.
  const { data: dono, error: errLock } = await sb
    .from("app_leads")
    .update({ ultimo_atendente_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", s.tenantId)
    .eq("atendente_id", s.userId)
    .select("id");
  if (errLock) return { ok: false, erro: errLock.message };
  if (!dono || dono.length === 0) {
    return { ok: false, erro: "Você não está com esta conversa. Assuma antes de enviar." };
  }

  const texto = (caption ?? "").trim();
  const { data: msgRow, error } = await sb
    .from("app_mensagens")
    .insert({
      lead_id: leadId,
      autor: "atendente",
      texto,
      tenant_id: s.tenantId,
      midia_url: path,
      midia_tipo: tipo,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message };

  // URL de leitura assinada (10 min) para o canal buscar o arquivo.
  const admin = getCrmAdmin();
  const { data: signed } = await admin.storage.from("midias").createSignedUrl(path, 600);
  if (!signed?.signedUrl) {
    return { ok: true, aviso: "Anexo salvo, mas não consegui gerar o link para o envio." };
  }

  const entrega = await dispatchOutbound(
    s.tenantId,
    leadId,
    texto,
    (msgRow?.id as number | undefined) ?? undefined,
    { url: signed.signedUrl, tipo: tipoCanal(tipo), mime, filename }
  );

  await registrarEvento({
    tenantId: s.tenantId,
    leadId,
    tipo: "first_response_sent",
    canal: entrega.canal ?? null,
    dados: { autor: "atendente", midia: tipo },
  });

  if (!entrega.ok && entrega.canal !== "painel") {
    return {
      ok: true,
      aviso: entrega.erro
        ? `Anexo salvo, mas não foi entregue: ${entrega.erro}`
        : "Anexo salvo, mas a entrega no canal falhou. Verifique a conexão do canal.",
    };
  }
  return { ok: true };
}
