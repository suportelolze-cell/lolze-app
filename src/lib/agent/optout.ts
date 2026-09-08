// Detecção determinística de pedido de parada (opt-out) do contato.
// Roda ANTES da IA e independe dela: se o contato pede pra parar, a automação
// para na hora. É o guarda anti-ban/anti-denúncia mais importante — responder a
// quem pediu "PARE" é o que mais gera denúncia e derruba número no WhatsApp.
//
// Conservador de propósito: só pega pedidos ÓBVIOS. Um falso positivo mataria um
// lead quente à toa; um caso sutil ainda é coberto pela tool encerrar_lead da IA.
// Módulo folha (sem imports) para poder ser testado com `node --test`.

function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acento
    .replace(/[!.…]+$/g, "") // tira pontuação final (inclui reticências)
    .trim();
}

// Mensagem curta e exata (a mensagem INTEIRA é o comando).
const EXATOS = new Set([
  "pare",
  "parar",
  "sair",
  "stop",
  "descadastrar",
  "descadastra",
  "unsubscribe",
]);

// Trechos inequívocos em qualquer lugar da mensagem.
const FRASES = [
  "pare de me mand",
  "para de me mand",
  "parem de me mand",
  "para de mandar mensag",
  "nao quero mais receber",
  "nao quero receber mensag",
  "nao quero mais mensag",
  "nao me mande mais",
  "nao me mandem mais",
  "me tira da lista",
  "me remova da lista",
  "sair da lista",
  "cancelar inscricao",
  "descadastr",
];

/** true se o contato pediu, de forma clara, para parar de receber mensagens. */
export function ehPedidoParada(texto: string): boolean {
  const t = normalizar(texto);
  if (!t) return false;
  if (EXATOS.has(t)) return true;
  return FRASES.some((f) => t.includes(f));
}

/** Confirmação enviada UMA vez quando o contato opta por sair. */
export const MSG_CONFIRMACAO_PARADA =
  "Prontinho, não te envio mais mensagens automáticas por aqui. Se um dia precisar, é só chamar que a gente te atende. 💚";
