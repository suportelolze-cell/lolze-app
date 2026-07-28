import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas acessíveis sem login (landing pública + login/cadastro + páginas legais)
const PUBLICAS = ["/", "/login", "/cadastro", "/privacidade", "/termos", "/cookies"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_CRM_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_CRM_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const publica = PUBLICAS.includes(path);

  if (!user && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Roda em tudo, MENOS APIs, assets do Next e arquivos estáticos (por extensão)
    // — assim /public (ex.: o modelo .txt) é servido direto, sem passar pela auth.
    "/((?!api/|_next/static|_next/image|favicon.ico|logo/|fonts/|.*\\.(?:svg|txt|pdf|png|jpe?g|webp|gif|ico|xml|csv|woff2?)$).*)",
  ],

};
