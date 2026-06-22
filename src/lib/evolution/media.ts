import { getAnthropic, temChaveIA, SDR_MODEL } from "@/lib/agent/anthropic";

/**
 * Converte mídia recebida no WhatsApp em texto, para o SDR entender.
 * - áudio  → transcrição (OpenAI Whisper)
 * - imagem → descrição objetiva (Claude Vision, nativo)
 * - documento (PDF) → extração de texto
 * Tudo best-effort: se falhar, devolve string vazia (o fluxo segue).
 */

export type TipoMidia = "audio" | "imagem" | "documento";

async function transcreverAudio(base64: string, mime: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";
  const buf = Buffer.from(base64, "base64");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime || "audio/ogg" }), "audio.ogg");
  form.append("model", "whisper-1");
  form.append("language", "pt");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return "";
  const j = (await res.json()) as { text?: string };
  return (j.text || "").trim();
}

async function descreverImagem(base64: string, mime: string): Promise<string> {
  if (!temChaveIA()) return "";
  const client = getAnthropic();
  const tipo = (mime || "image/jpeg").split(";")[0];
  const media_type = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(tipo)
    ? tipo
    : "image/jpeg";
  const res = await client.messages.create({
    model: SDR_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: media_type as never, data: base64 },
          },
          {
            type: "text",
            text:
              "Descreva de forma objetiva o que aparece nesta imagem, no contexto de um " +
              "atendimento de vendas: textos visíveis, produtos, documentos, valores, dados " +
              "de contato e a situação. Seja direto.",
          },
        ],
      },
    ],
  });
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .trim();
}

async function extrairPdf(base64: string): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    b: Buffer
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buf);
  return (data.text || "").trim();
}

export async function midiaParaTexto(
  tipo: TipoMidia,
  base64: string,
  mime: string
): Promise<string> {
  try {
    if (tipo === "audio") {
      const t = await transcreverAudio(base64, mime);
      return t ? `(áudio) ${t}` : "";
    }
    if (tipo === "imagem") {
      const t = await descreverImagem(base64, mime);
      return t ? `(imagem enviada pelo cliente) ${t}` : "";
    }
    if (tipo === "documento") {
      const t = await extrairPdf(base64);
      return t ? `(documento enviado) ${t.slice(0, 4000)}` : "";
    }
  } catch {
    return "";
  }
  return "";
}
