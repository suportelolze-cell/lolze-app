// Copy das seções por tipo de operação (playbook). Um lojista/prestador de
// serviço e um produtor de infoproduto falam línguas diferentes: "cliente" x
// "comprador", "serviço fechado" x "venda", "agenda" x "call". Aqui fica o texto
// que cada seção usa para se explicar e convencer, adaptado a quem está usando.
//
// Módulo de dados puro (sem imports) — pode ser importado tanto em Server quanto
// em Client Components. Sem travessão na prosa (preferência do produto).

export type PlaybookCopy = "servico_local" | "infoproduto";

const COPY: Record<string, Record<PlaybookCopy, string>> = {
  painel: {
    servico_local:
      "O retrato da sua operação agora: quantos clientes chegaram, quantos a IA já qualificou e quantos agendaram. Tudo que vira dinheiro numa tela só.",
    infoproduto:
      "O retrato do seu negócio agora: quanto você faturou, quantas vendas saíram e quantos pagamentos ainda dá pra recuperar. Sua operação inteira numa tela só.",
  },
  pipeline: {
    servico_local:
      "Cada cliente em potencial na etapa certa, do primeiro contato até o serviço fechado. Arraste os cards e veja o funil andar.",
    infoproduto:
      "Cada lead e comprador na etapa certa, do primeiro contato até a venda. Arraste os cards e veja o funil andar.",
  },
  atendimento: {
    servico_local:
      "A IA responde na hora e qualifica cada contato. Você assume no momento certo pra fechar o serviço, sem deixar ninguém no vácuo.",
    infoproduto:
      "A IA responde na hora e qualifica cada contato. Você assume no momento certo pra fechar a venda, sem deixar ninguém no vácuo.",
  },
  agenda: {
    servico_local:
      "Sua agenda cheia e protegida contra faltas. A IA marca, confirma e lembra o cliente por você.",
    infoproduto:
      "Suas calls de fechamento organizadas e sem furos. A IA marca, confirma e lembra o comprador por você.",
  },
  contatos: {
    servico_local:
      "Todos os seus clientes e contatos, de todos os canais, num lugar só. Filtre por quem fechou, quem esfriou e quem merece um novo toque.",
    infoproduto:
      "Todos os seus compradores e leads, de todos os canais, num lugar só. Filtre por quem comprou, quem esfriou e quem merece um novo toque.",
  },
  resultados: {
    servico_local:
      "Cada número é um evento real: lead recebido, resposta, agendamento, comparecimento e venda. Nada estimado, nada inventado.",
    infoproduto:
      "Cada número é um evento real: lead recebido, resposta, venda aprovada e receita confirmada. Nada estimado, nada inventado.",
  },
  configuracoes: {
    servico_local:
      "O coração da sua operação: conexões, equipe e as regras que a IA segue. Ajuste uma vez e deixe rodar no automático.",
    infoproduto:
      "O coração da sua operação: conexões, equipe e as regras que a IA segue. Ajuste uma vez e deixe rodar no automático.",
  },
  // Empty state do Resultados: a tela vazia que acolhe o cliente novo e explica
  // que ela se preenche sozinha conforme a operação roda.
  resultados_vazio: {
    servico_local:
      "Esta tela se preenche sozinha conforme a operação roda: cada lead recebido, resposta da IA, agendamento, comparecimento e serviço fechado vira um fato datado aqui. Assim que os primeiros leads chegarem, os resultados aparecem, sem você lançar nada à mão.",
    infoproduto:
      "Esta tela se preenche sozinha conforme a operação roda: cada lead recebido, resposta da IA, venda aprovada e receita confirmada vira um fato datado aqui. Assim que as primeiras vendas entrarem, os resultados aparecem, sem você lançar nada à mão.",
  },
};

/** Descrição da seção para o playbook do tenant. Cai em servico_local se faltar. */
export function descricaoSecao(secao: string, playbook: PlaybookCopy = "servico_local"): string {
  const s = COPY[secao];
  if (!s) return "";
  return s[playbook] ?? s.servico_local;
}
