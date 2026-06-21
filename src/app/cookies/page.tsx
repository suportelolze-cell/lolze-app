import { LegalPage, H2, P, UL } from "@/components/legal/Legal";

export const metadata = { title: "Política de Cookies · Lolze" };

export default function CookiesPage() {
  return (
    <LegalPage titulo="Política de Cookies" atualizado="14 de junho de 2026">
      <P>
        Esta Política explica o que são cookies, como a <strong>Lolze</strong>{" "}
        (operada por Abner Oliveira) os utiliza e como você pode gerenciá-los, em linha com
        a LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet.
      </P>

      <H2>1. O que são cookies</H2>
      <P>
        Cookies são pequenos arquivos armazenados no seu dispositivo quando você
        visita um site. Eles permitem lembrar preferências, manter sessões ativas
        e medir o desempenho das páginas. Também usamos tecnologias similares,
        como armazenamento local (localStorage).
      </P>

      <H2>2. Tipos de cookies que utilizamos</H2>
      <UL>
        <li>
          <strong>Essenciais</strong>: necessários para o funcionamento do site e
          da plataforma (ex.: autenticação e segurança da sessão). Não exigem
          consentimento.
        </li>
        <li>
          <strong>Desempenho/Analytics</strong>: ajudam a entender o uso do site
          para melhorá-lo (ex.: páginas mais acessadas). Dependem do seu
          consentimento.
        </li>
        <li>
          <strong>Marketing</strong>: usados para medir campanhas e exibir
          conteúdo relevante (ex.: pixel da Meta, Google). Dependem do seu
          consentimento.
        </li>
      </UL>

      <H2>3. Cookies de terceiros</H2>
      <P>
        Quando ativados, recursos de terceiros podem definir cookies próprios, com
        políticas independentes, por exemplo:
      </P>
      <UL>
        <li>Meta (Pixel/Conversions API): medição de campanhas;</li>
        <li>Google (Analytics/Ads): análise e mensuração;</li>
        <li>Provedores de atendimento e mensageria, quando aplicável.</li>
      </UL>

      <H2>4. Como gerenciar seus cookies</H2>
      <P>
        Na sua primeira visita, exibimos um aviso para você{" "}
        <strong>aceitar</strong> ou <strong>recusar</strong> os cookies não
        essenciais. Você pode mudar de ideia a qualquer momento limpando os dados
        do site no navegador. Também é possível bloquear ou apagar cookies nas
        configurações do seu navegador. Note que isso pode afetar funcionalidades.
      </P>

      <H2>5. Consentimento</H2>
      <P>
        Cookies não essenciais só são ativados após o seu consentimento. A retirada
        do consentimento não afeta a licitude do tratamento realizado antes da
        retirada.
      </P>

      <H2>6. Atualizações</H2>
      <P>
        Esta Política pode ser atualizada para refletir mudanças em nossas
        práticas ou na legislação. Consulte sempre a data de
        &quot;Última atualização&quot;.
      </P>

      <H2>7. Contato</H2>
      <P>
        Dúvidas sobre cookies e privacidade: <strong>suporte.lolze@gmail.com</strong>.
      </P>
    </LegalPage>
  );
}
