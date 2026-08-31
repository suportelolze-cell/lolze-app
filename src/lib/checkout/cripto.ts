import crypto from "node:crypto";

/**
 * Cifra em repouso dos segredos de webhook do checkout (SEG-07).
 *
 * Objetivo: um dump do banco, sozinho, não revela os segredos de assinatura das
 * plataformas. A chave NÃO fica no banco — é derivada de um segredo do servidor
 * (APP_CRYPTO_KEY se existir, senão a service-role do Supabase, que já é a joia
 * da coroa). Sem esse material, o app não decifra.
 *
 * Formato: "enc:v1:" + base64(iv[12] || tag[16] || cifrado). AES-256-GCM
 * (autenticado: adulteração falha na verificação). Módulo folha (só node:crypto)
 * para poder ser testado com `node --test`.
 */
const PREFIXO = "enc:v1:";

function material(): string {
  return process.env.APP_CRYPTO_KEY || process.env.SUPABASE_CRM_SERVICE_KEY || "";
}

/** 32 bytes derivados de forma estável do material do servidor, ou null. */
function chave(): Buffer | null {
  const m = material();
  if (!m) return null;
  return crypto.createHash("sha256").update(m).digest();
}

export function estaCifrado(v: string | null | undefined): boolean {
  return !!v && v.startsWith(PREFIXO);
}

/** Cifra um texto. Sem chave (ou texto vazio), devolve o texto como está — nunca perde dado. */
export function cifrar(texto: string): string {
  const k = chave();
  if (!k || !texto) return texto;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIXO + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decifra. Texto puro legado (sem o prefixo) passa direto — retrocompatível com
 * segredos gravados antes da cifra. Cifrado sem a chave, ou adulterado, vira "".
 */
export function decifrar(armazenado: string | null | undefined): string {
  if (!armazenado) return "";
  if (!estaCifrado(armazenado)) return armazenado;
  const k = chave();
  if (!k) return "";
  try {
    const buf = Buffer.from(armazenado.slice(PREFIXO.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
