import { getCrmServer } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/supabase/tenant";

/** Respostas rápidas padrão (usadas quando o cliente não personalizou). */
export const RESPOSTAS_PADRAO = [
  "Olá! Tudo bem? 😊 Como posso te ajudar?",
  "Perfeito! Já te passo os detalhes.",
  "Consigo te encaixar ainda esta semana. Prefere manhã ou tarde?",
  "Ótima pergunta! Deixa eu confirmar essa informação pra você.",
  "Pode me mandar seu melhor e-mail para eu te enviar tudo certinho?",
  "Qualquer dúvida, estou por aqui. 🙌",
];

/** Texto bruto das respostas rápidas do tenant (para o editor). "" se não houver. */
export async function getRespostasRapidasRaw(): Promise<string> {
  const tid = await getTenantId();
  if (!tid) return "";
  const sb = await getCrmServer();
  const { data } = await sb
    .from("app_config")
    .select("respostas_rapidas")
    .eq("tenant_id", tid)
    .maybeSingle();
  return (data?.respostas_rapidas ?? "") as string;
}

/** Lê as respostas rápidas do tenant (uma por linha) ou devolve as padrão. */
export async function getRespostasRapidas(): Promise<string[]> {
  const tid = await getTenantId();
  if (!tid) return RESPOSTAS_PADRAO;
  const sb = await getCrmServer();
  const { data } = await sb
    .from("app_config")
    .select("respostas_rapidas")
    .eq("tenant_id", tid)
    .maybeSingle();
  const raw = String(data?.respostas_rapidas ?? "").trim();
  if (!raw) return RESPOSTAS_PADRAO;
  return raw
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean);
}
