import { redirect } from "next/navigation";
import { ROTAS } from "@/lib/rotas";

// O cadastro canônico agora é /auth/register (namespace de auth protegido no
// Cloudflare). /cadastro fica só como redirect, para não quebrar links antigos.
export default async function CadastroRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp?.plano ? `?plano=${encodeURIComponent(sp.plano)}` : "";
  redirect(`${ROTAS.auth.register}${qs}`);
}
