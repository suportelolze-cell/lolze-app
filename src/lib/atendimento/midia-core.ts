/**
 * Núcleo PURO (sem `@/`, sem I/O) das regras de mídia do atendimento.
 * Classifica MIME, mapeia para o tipo do canal e valida tamanho. Testável via
 * `node --test` (importado por caminho relativo em tests/).
 */

export type MidiaTipo = "imagem" | "video" | "audio" | "documento";

/** Tipo do canal (WhatsApp Cloud / Evolution usam os nomes em inglês). */
export type MidiaCanal = "image" | "video" | "audio" | "document";

/** Limites de tamanho do WhatsApp por tipo, em bytes (margem conservadora). */
export const LIMITES_MIDIA: Record<MidiaTipo, number> = {
  imagem: 5 * 1024 * 1024, // 5 MB
  video: 16 * 1024 * 1024, // 16 MB
  audio: 16 * 1024 * 1024, // 16 MB
  documento: 100 * 1024 * 1024, // 100 MB
};

/**
 * Classifica um MIME em um tipo de mídia (ou null se não suportado).
 * Imagem só cobre jpeg/png (o que o WhatsApp aceita como imagem); heic/webp/gif
 * e outros image/* viram 'documento' e são entregues como ARQUIVO (sempre chega,
 * em vez de falhar no envio).
 */
export function tipoDeMime(mime: string): MidiaTipo | null {
  const m = (mime || "").toLowerCase().trim();
  if (m === "image/jpeg" || m === "image/jpg" || m === "image/png") return "imagem";
  if (m.startsWith("image/")) return "documento"; // heic/webp/gif → como arquivo
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || m.startsWith("application/") || m.startsWith("text/"))
    return "documento";
  return null;
}

/** Mapeia o nosso tipo (pt) para o tipo do canal (en). */
export function tipoCanal(tipo: MidiaTipo): MidiaCanal {
  if (tipo === "imagem") return "image";
  if (tipo === "documento") return "document";
  return tipo; // video | audio
}

/** O arquivo cabe no limite do tipo? (bytes > 0 e <= limite) */
export function dentroDoLimite(tipo: MidiaTipo, bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= LIMITES_MIDIA[tipo];
}

/** Extensão do nome do arquivo (minúscula, sem ponto; 'bin' se não achar). */
export function extDeNome(nome: string): string {
  const m = /\.([a-z0-9]+)$/i.exec((nome || "").trim());
  return m ? m[1].toLowerCase() : "bin";
}

/** Limite em MB (para mensagens ao usuário). */
export function limiteMb(tipo: MidiaTipo): number {
  return Math.round(LIMITES_MIDIA[tipo] / (1024 * 1024));
}

/**
 * Valida um caminho do bucket 'midias' com regex ESTRITO no formato que os
 * uploads emitem (`<tenantId>/<subpasta>/<uuid>.<ext>`). Barra path traversal
 * (`..`, barras extras) e caminhos de fora do prefixo — defesa em profundidade
 * antes de qualquer createSignedUrl/remove com service_role. tenantId é UUID
 * (sem caracteres especiais de regex).
 */
export function caminhoMidiaValido(
  path: string,
  tenantId: string,
  subpasta: "atendente" | "biblioteca"
): boolean {
  if (!path || !tenantId) return false;
  const re = new RegExp(`^${tenantId}/${subpasta}/[a-z0-9-]+\\.[a-z0-9]{1,8}$`, "i");
  return re.test(path);
}
