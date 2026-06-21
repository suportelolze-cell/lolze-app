import { LegalPage, H2, P, UL } from "@/components/legal/Legal";

export const metadata = { title: "Termos de Uso · Lolze" };

export default function TermosPage() {
  return (
    <LegalPage titulo="Termos de Uso" atualizado="14 de junho de 2026">
      <P>
        Estes Termos de Uso regem o acesso e a utilização da plataforma e do site
        da <strong>Lolze</strong>, operada por <strong>Abner Oliveira</strong>{" "}
        (empresa em constituição), contato <strong>suporte.lolze@gmail.com</strong>{" "}
        (&quot;Lolze&quot;). Ao criar uma conta ou usar nossos serviços, você
        declara ter lido e concordado com estes Termos e com a{" "}
        <a href="/privacidade" className="text-marca underline">Política de Privacidade</a>.
      </P>

      <H2>1. Definições</H2>
      <UL>
        <li><strong>Plataforma</strong>: o sistema Lolze (painel, CRM, automações e integrações).</li>
        <li><strong>Usuário/Cliente</strong>: pessoa física ou jurídica que contrata ou utiliza os serviços.</li>
        <li><strong>Conteúdo do Cliente</strong>: dados e materiais inseridos pelo Cliente na Plataforma.</li>
      </UL>

      <H2>2. Descrição do serviço</H2>
      <P>
        A Lolze oferece um ecossistema de aquisição e gestão de clientes
        (tráfego, atendimento por IA, CRM e agendamento). Os recursos disponíveis
        dependem do plano contratado e podem ser ajustados para melhoria contínua.
      </P>

      <H2>3. Cadastro e conta</H2>
      <UL>
        <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
        <li>As credenciais são pessoais e intransferíveis; você é responsável por sua confidencialidade.</li>
        <li>É necessário ter capacidade civil (maior de 18 anos) e, no caso de pessoa jurídica, poderes para contratar.</li>
      </UL>

      <H2>4. Uso aceitável</H2>
      <P>É vedado ao Usuário:</P>
      <UL>
        <li>Usar a Plataforma para fins ilícitos, enganosos ou que violem direitos de terceiros;</li>
        <li>Enviar spam ou mensagens sem a devida base legal/consentimento dos destinatários;</li>
        <li>Tentar acessar áreas restritas, realizar engenharia reversa ou comprometer a segurança;</li>
        <li>Sobrecarregar a infraestrutura ou utilizar a Plataforma de forma abusiva.</li>
      </UL>
      <P>
        O Cliente é o único responsável pelo Conteúdo do Cliente e por obter as
        bases legais necessárias (inclusive consentimento) para tratar os dados de
        seus contatos por meio da Plataforma.
      </P>

      <H2>5. Propriedade intelectual</H2>
      <P>
        A Plataforma, marca, software, layout e materiais são de titularidade da
        Lolze, protegidos por lei. Concedemos ao Usuário uma licença limitada,
        não exclusiva e intransferível de uso durante a vigência do contrato. O
        Conteúdo do Cliente permanece de titularidade do Cliente.
      </P>

      <H2>6. Planos, pagamento e cancelamento</H2>
      <UL>
        <li>Os valores, a periodicidade e a forma de pagamento são informados na contratação.</li>
        <li>A falta de pagamento pode suspender ou encerrar o acesso, após aviso.</li>
        <li>
          <strong>Direito de arrependimento (CDC, art. 49):</strong> nas
          contratações realizadas fora do estabelecimento (ex.: pela internet), o
          consumidor pode desistir em até <strong>7 (sete) dias</strong> a contar
          da contratação, com devolução dos valores eventualmente pagos.
        </li>
        <li>Cancelamentos após esse prazo seguem as condições do plano contratado.</li>
      </UL>

      <H2>7. Disponibilidade e isenções</H2>
      <P>
        Empregamos esforços para manter a Plataforma disponível, mas não
        garantimos operação ininterrupta ou livre de erros. Poderá haver
        manutenções programadas e indisponibilidades por fatores de terceiros
        (provedores, APIs externas, força maior).
      </P>

      <H2>8. Limitação de responsabilidade</H2>
      <P>
        Na máxima extensão permitida pela lei, a Lolze não se responsabiliza por
        danos indiretos, lucros cessantes ou resultados comerciais esperados pelo
        Cliente. A Lolze não garante volume de vendas ou resultados específicos,
        que dependem de múltiplos fatores alheios à Plataforma.
      </P>

      <H2>9. Proteção de dados</H2>
      <P>
        O tratamento de dados pessoais observa a{" "}
        <a href="/privacidade" className="text-marca underline">Política de Privacidade</a>.
        Quando a Lolze atuar como operadora dos dados do Cliente, o tratamento se
        dará conforme as instruções do Cliente e a legislação aplicável.
      </P>

      <H2>10. Vigência e rescisão</H2>
      <P>
        Estes Termos vigoram enquanto você utilizar os serviços. Podemos
        suspender ou encerrar o acesso em caso de violação. Após o encerramento, o
        Conteúdo do Cliente poderá ser excluído conforme os prazos da Política de
        Privacidade.
      </P>

      <H2>11. Alterações</H2>
      <P>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas e a
        continuidade do uso implica concordância com a versão vigente.
      </P>

      <H2>12. Lei aplicável e foro</H2>
      <P>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da
        comarca de <strong>Indaiatuba/SP</strong>, salvo regra de competência legal
        que disponha de modo diverso (inclusive em favor do consumidor).
      </P>
    </LegalPage>
  );
}
