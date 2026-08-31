import { redirect } from "next/navigation";

/**
 * A seção de Captação & Disparos foi retirada do produto por ora (será retomada
 * depois, com calma). O código do módulo (lib/captacao, componentes, cron)
 * segue no repo, dormente; só a tela saiu da navegação. A rota redireciona pra
 * não quebrar links antigos.
 */
export default function CaptacaoPage() {
  redirect("/painel");
}
