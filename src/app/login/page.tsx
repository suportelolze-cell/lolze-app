import { redirect } from "next/navigation";
import { ROTAS } from "@/lib/rotas";

// A tela de login canônica agora é /auth/login. Mantemos /login apenas como
// redirecionamento, para não quebrar links e favoritos antigos.
export default function LoginRedirect() {
  redirect(ROTAS.auth.login);
}
