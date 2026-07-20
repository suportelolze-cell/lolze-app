import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do CRM no servidor, com a sessão lida dos cookies.
 * Os fetches (server components) carregam o JWT do usuário → RLS "authenticated".
 */
export async function getCrmServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_CRM_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_CRM_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um server component (sem permissão de set) — ok,
            // o middleware cuida do refresh.
          }
        },
      },
    }
  );
}
