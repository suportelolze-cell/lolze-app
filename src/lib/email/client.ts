/**
 * Canal de e-mail (transacional) — Fase 4 do pivô. Provedor via HTTP (Resend),
 * sem SDK extra. Server-only: usa segredos de env (nunca NEXT_PUBLIC_).
 *
 * DARK por padrão: sem RESEND_API_KEY + EMAIL_FROM configurados, enviarEmail
 * não faz nada (skipped). Ativação = setar as env vars + domínio autenticado
 * (SPF/DKIM/DMARC) no provedor. Deliverability real depende disso.
 */

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type ResultadoEmail = { ok: boolean; skipped?: string; erro?: string };

export async function enviarEmail(input: {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}): Promise<ResultadoEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, skipped: "sem_config" };

  const para = (input.para || "").trim();
  if (!para || !para.includes("@")) return { ok: false, erro: "e-mail inválido" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [para],
        subject: input.assunto,
        text: input.texto,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      return { ok: false, erro: `provedor ${res.status}: ${corpo.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha no envio" };
  } finally {
    clearTimeout(timer);
  }
}
