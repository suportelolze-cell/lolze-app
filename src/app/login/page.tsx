import { redirect } from "next/navigation";

// A tela de login canônica agora é /auth/login. Mantemos /login apenas como
// redirecionamento, para não quebrar links e favoritos antigos.
export default function LoginRedirect() {
  redirect("/auth/login");
}
