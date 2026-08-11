import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas acessíveis sem login (landing pública + auth + cadastro + páginas legais)
const PUBLICAS = [
  "/",
  "/login",
  "/cadastro",
  "/auth/login",
  "/auth/register",
  "/auth/forgot",
  "/auth/reset",
  "/auth/callback",
  "/privacidade",
  "/termos",
  "/cookies",
];

// Split por subdomínio (só vale nestes hosts de produção). Em localhost e nos
// previews *.vercel.app o app roda "tudo junto", como antes.
const HOST_APP = "app.lolze.com.br";
const HOST_ADMIN = "admin.lolze.com.br";
const HOSTS_RAIZ = ["lolze.com.br", "www.lolze.com.br"];

const LEGAIS = ["/privacidade", "/termos", "/cookies"];

const ehAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/");

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
  const host = (req.headers.get("host") || req.nextUrl.hostname).split(":")[0].toLowerCase();

  const ehRaiz = HOSTS_RAIZ.includes(host);
  const ehApp = host === HOST_APP;
  const ehAdmin = host === HOST_ADMIN;
  const split = ehRaiz || ehApp || ehAdmin;

  // Redireciona trocando o host (mesmo path/query), forçando https.
  const paraHost = (destHost: string) => {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = destHost;
    url.port = "";
    return NextResponse.redirect(url);
  };
  const paraPath = (destPath: string) => {
    const url = req.nextUrl.clone();
    url.pathname = destPath;
    return NextResponse.redirect(url);
  };

  // ---------- Roteamento por subdomínio (só nos hosts reais) ----------
  if (split) {
    if (ehRaiz) {
      // A raiz serve só a landing e as páginas legais. O resto vai pro subdomínio
      // certo: /admin* pro admin, qualquer outra coisa (auth, app) pro app.
      const permitidoNaRaiz = path === "/" || LEGAIS.includes(path);
      if (!permitidoNaRaiz) return paraHost(ehAdminPath(path) ? HOST_ADMIN : HOST_APP);
    } else if (ehApp) {
      // App do cliente. O /admin NÃO existe aqui (fica isolado no admin.).
      if (ehAdminPath(path)) return paraHost(HOST_ADMIN);
      // A landing não aparece no app: a raiz vai pro painel (ou login).
      if (path === "/") return paraPath(user ? "/painel" : "/auth/login");
    } else if (ehAdmin) {
      // Admin (atrás do Cloudflare Access + guard de superadmin no layout).
      // A raiz vai pro painel de admin (ou login). As demais rotas (auth, /admin
      // e as de cliente, usadas na impersonação) seguem normalmente.
      if (path === "/") return paraPath(user ? "/admin" : "/auth/login");
    }
  }

  // ---------- Autenticação (o destino do "já logado" é ciente do host) ----------
  const publica = PUBLICAS.includes(path);

  if (!user && !publica) {
    return paraPath("/auth/login");
  }
  if (user && (path === "/login" || path === "/auth/login")) {
    return paraPath(ehAdmin ? "/admin" : "/painel");
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
