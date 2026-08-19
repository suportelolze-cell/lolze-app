import { redirect } from "next/navigation";

/**
 * Recorrência foi aposentada como página própria: a régua de churn e a ação
 * "reativar com IA" agora vivem dentro de Contatos (filtro de "último contato"
 * + ação por linha). Mantemos a rota redirecionando para não quebrar links
 * antigos/atalhos.
 */
export default function RecorrenciaPage() {
  redirect("/contatos");
}
