import { redirect } from "next/navigation";

// O cadastro fica em /cadastro (ligado à escolha de plano/Stripe). /auth/register
// é o apelido no namespace de auth: redireciona preservando o ?plano.
export default async function RegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp?.plano ? `?plano=${encodeURIComponent(sp.plano)}` : "";
  redirect(`/cadastro${qs}`);
}
