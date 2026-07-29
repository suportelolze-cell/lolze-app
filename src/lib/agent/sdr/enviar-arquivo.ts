import { getCrmAdmin } from "@/lib/supabase/admin";
import { dispatchOutbound } from "@/lib/integracoes/outbound";
import { tipoCanal, type MidiaTipo } from "@/lib/atendimento/midia-core";

type Admin = ReturnType<typeof getCrmAdmin>;

/**
 * A IA envia um arquivo PRONTO da biblioteca ao lead (tool enviar_arquivo).
 * Grava como mensagem da IA (autor 'ia') e entrega pelo canal como mídia.
 * Devolve a confirmação (string) para o modelo continuar. Nunca lança.
 */
export async function enviarArquivoBiblioteca(
  admin: Admin,
  tenantId: string,
  leadId: number,
  id: string,
  jaEnviados: Set<string>
): Promise<string> {
  try {
    if (!id) return "Informe o id do arquivo.";
    if (jaEnviados.has(id)) return "Esse arquivo já foi enviado nesta conversa.";

    const { data: item } = await admin
      .from("app_biblioteca_midia")
      .select("nome,tipo,path,mime,filename,ativo")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!item || item.ativo === false || !item.path) {
      return "Arquivo não encontrado na biblioteca (confira o id).";
    }

    // Trava DURA entre turnos: se este arquivo já foi enviado a este lead (e não
    // falhou), não reenvia — evita spam mesmo se o modelo reincidir num turno novo.
    const { data: jaFoi } = await admin
      .from("app_mensagens")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .eq("midia_url", item.path)
      .neq("status", "falhou")
      .limit(1);
    if (jaFoi && jaFoi.length > 0) {
      jaEnviados.add(id);
      return `O arquivo "${item.nome}" já foi enviado a este lead; não envie de novo.`;
    }

    const { data: signed } = await admin.storage
      .from("midias")
      .createSignedUrl(item.path as string, 600);
    if (!signed?.signedUrl) return "Não consegui preparar o arquivo agora.";

    // Legenda = nome do item: nunca vazia (não quebra o histórico do modelo) e
    // rotula o arquivo no chat.
    const legenda = (item.nome as string) || "Arquivo";
    const { data: msgRow } = await admin
      .from("app_mensagens")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        autor: "ia",
        texto: legenda,
        midia_url: item.path,
        midia_tipo: item.tipo,
      })
      .select("id")
      .single();

    const entrega = await dispatchOutbound(
      tenantId,
      leadId,
      legenda,
      (msgRow?.id as number | undefined) ?? undefined,
      {
        url: signed.signedUrl,
        tipo: tipoCanal(item.tipo as MidiaTipo),
        mime: (item.mime as string | null) ?? undefined,
        filename: (item.filename as string | null) ?? undefined,
      }
    );

    jaEnviados.add(id);
    if (!entrega.ok && entrega.canal !== "painel") {
      return `Tentei enviar "${item.nome}" mas a entrega falhou (${entrega.erro ?? "canal"}).`;
    }
    return `Arquivo "${item.nome}" enviado ao lead.`;
  } catch (e) {
    return "Não consegui enviar o arquivo: " + (e instanceof Error ? e.message : String(e));
  }
}
