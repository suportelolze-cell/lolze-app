/**
 * Bateria padrão de testes de implantação (dossiê P1.5) — PURO, sem I/O, para
 * ter teste de integridade e poder ser importado em qualquer lugar.
 *
 * Agnóstica de nicho e pensada para MICROEMPREENDEDORES no geral: cobre os três
 * arquétipos (serviço com agenda, venda de produto, orçamento) + os casos
 * típicos do WhatsApp (áudio, pedido de humano, fora de escopo). Cada item é
 * rodado por simularSDR e o operador aprova o agente antes do go-live.
 */
export type CasoTeste = { chave: string; rotulo: string; pergunta: string };

export const BATERIA_PADRAO: CasoTeste[] = [
  { chave: "preco", rotulo: "Pergunta de preço", pergunta: "Oi! Quanto custa?" },
  {
    chave: "oferta",
    rotulo: "Sobre o que você faz",
    pergunta: "Me explica como funciona o serviço/produto de vocês?",
  },
  {
    chave: "agenda",
    rotulo: "Pedido de horário (serviço com agenda)",
    pergunta: "Queria marcar um horário pra amanhã à tarde, tem vaga?",
  },
  {
    chave: "produto",
    rotulo: "Compra de produto",
    pergunta: "Vocês têm disponível pra comprar? Fazem entrega?",
  },
  {
    chave: "orcamento",
    rotulo: "Pedido de orçamento",
    pergunta: "Consegue me passar um orçamento pro meu caso?",
  },
  {
    chave: "pagamento",
    rotulo: "Formas de pagamento",
    pergunta: "Como funciona o pagamento? Aceita Pix ou cartão?",
  },
  {
    chave: "local_horario",
    rotulo: "Endereço e horário",
    pergunta: "Onde vocês ficam e que horas abrem?",
  },
  {
    chave: "reagendar",
    rotulo: "Remarcar horário",
    pergunta: "Preciso remarcar, dá pra mudar meu horário pra outro dia?",
  },
  {
    chave: "objecao",
    rotulo: "Objeção clássica",
    pergunta: "Achei interessante, mas vou pensar e te falo depois.",
  },
  {
    chave: "humano",
    rotulo: "Pedido de atendente humano",
    pergunta: "Prefiro falar com uma pessoa de verdade, dá pra me passar pra alguém?",
  },
  {
    chave: "audio",
    rotulo: "Cliente mandou áudio",
    pergunta: "Te mandei um áudio agora explicando, consegue ouvir?",
  },
  {
    chave: "fora_escopo",
    rotulo: "Fora do escopo",
    pergunta: "Você pode me dar um conselho jurídico sobre um processo que estou respondendo?",
  },
];
