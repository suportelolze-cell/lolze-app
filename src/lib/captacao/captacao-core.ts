/**
 * Núcleo PURO da Captação — sem dependências de `@/`, testável com `node --test`.
 * Renderização do texto do DISPARO (modo 'texto'): substitui placeholders pelos
 * dados de cada prospect. A rede/IA/DB ficam no enviar.ts/actions.ts.
 */

export type ProspectVars = {
  nome_empresa: string | null;
  cidade: string | null;
  nicho: string | null;
};

const PLACEHOLDERS = ["nome", "empresa", "cidade", "nicho"] as const;

/**
 * Substitui {nome}/{empresa}/{cidade}/{nicho} pelos valores do prospect.
 * - {nome} e {empresa} => nome_empresa (o mais comum na planilha).
 * - Placeholder desconhecido é mantido literal (aparece na prévia → o gestor
 *   corrige o erro de digitação antes de disparar).
 * - Valor ausente vira "" e a pontuação/espaço em excesso é limpa, para não
 *   sobrar "Olá !" quando a linha não tem nome.
 */
export function renderTemplate(tpl: string, p: ProspectVars): string {
  const nome = (p.nome_empresa || "").trim();
  const valores: Record<(typeof PLACEHOLDERS)[number], string> = {
    nome,
    empresa: nome,
    cidade: (p.cidade || "").trim(),
    nicho: (p.nicho || "").trim(),
  };
  return (tpl || "")
    .replace(/\{(\w+)\}/g, (original, chave: string) => {
      const k = chave.toLowerCase();
      return (PLACEHOLDERS as readonly string[]).includes(k)
        ? valores[k as (typeof PLACEHOLDERS)[number]]
        : original; // desconhecido: mantém literal
    })
    .replace(/[ \t]{2,}/g, " ") // espaços duplos (placeholder vazio)
    .replace(/ +([,.!?;:])/g, "$1") // espaço antes de pontuação ("Olá !")
    .replace(/[ \t]+\n/g, "\n") // espaço no fim de linha
    .trim();
}

/** Valida o texto do disparo antes de salvar. Devolve erro (string) ou null. */
export function validarMensagemDisparo(texto: string): string | null {
  const t = (texto || "").trim();
  if (!t) return "Escreva o texto do disparo (ou volte para o modo IA).";
  if (t.length > 1000) return "O texto do disparo está muito longo (máx. 1000 caracteres).";
  // Precisa de conteúdo ALÉM dos campos: um template só de {placeholders}
  // renderiza vazio para quem não tem o dado (e viraria "erro de envio" sem
  // nunca enviar). Exige texto literal.
  const semCampos = t.replace(/\{\w+\}/g, "").trim();
  if (!semCampos) {
    return "O texto precisa ter algo além dos campos (ex.: 'Olá {nome}, temos uma oferta!').";
  }
  return null;
}

/**
 * A coluna do modo de disparo (prospect_modo/prospect_mensagem) ainda não existe
 * — migração 20260803130000 pendente. PostgREST responde de forma diferente por
 * verbo: SELECT relaia o Postgres (code 42703, "does not exist"); UPDATE valida
 * o body contra o schema cache ANTES (code PGRST204, "...in the schema cache").
 * Cobrimos os dois códigos + a mensagem para o fallback ao legado ser confiável.
 */
export function erroDeColunaAusente(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /prospect_modo|prospect_mensagem|does not exist|schema cache/i.test(error.message ?? "");
}
