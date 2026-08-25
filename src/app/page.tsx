import { Landing } from "@/components/landing/Landing";

// Landing pública e estável: totalmente estática (sem consulta a banco). A
// seção de preços saiu, então não há mais dado dinâmico aqui.
export const revalidate = 300;

export default function Home() {
  return <Landing />;
}
