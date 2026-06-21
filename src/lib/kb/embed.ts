/** Embeddings via OpenAI (text-embedding-3-small = 1536 dims). SERVER-ONLY. */

const MODELO = "text-embedding-3-small";

export function temOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embedTextos(textos: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY ausente. Cole sua chave da OpenAI no .env.local para gerar embeddings."
    );
  }
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODELO, input: textos }),
  });
  if (!r.ok) {
    throw new Error("Falha nos embeddings: " + (await r.text()).slice(0, 200));
  }
  const j = (await r.json()) as { data: { index: number; embedding: number[] }[] };
  return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
