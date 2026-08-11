/**
 * Fonte ÚNICA das rotas do app (Clean Code: sem strings mágicas espalhadas pelo
 * código). Todo o namespace de autenticação vive sob `/auth/*`, que é o caminho
 * protegido no Cloudflare (WAF/rate limiting). Qualquer redirecionamento ou link
 * de navegação deve usar estas constantes, não literais soltos.
 */
export const ROTAS = {
  landing: "/",
  termos: "/termos",
  privacidade: "/privacidade",
  cookies: "/cookies",

  /** Autenticação — namespace protegido (/auth/*). */
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    forgot: "/auth/forgot",
    reset: "/auth/reset",
    callback: "/auth/callback",
  },

  /** App do cliente. */
  app: {
    painel: "/painel",
    onboarding: "/onboarding",
  },

  /** Painel administrativo (isolado no subdomínio admin). */
  admin: "/admin",

  /** Redirects legados, mantidos só por compatibilidade com links antigos. */
  legado: {
    login: "/login",
    cadastro: "/cadastro",
  },
} as const;

/** Rotas acessíveis sem login (landing, auth e páginas legais). */
export const ROTAS_PUBLICAS: readonly string[] = [
  ROTAS.landing,
  ROTAS.termos,
  ROTAS.privacidade,
  ROTAS.cookies,
  ROTAS.auth.login,
  ROTAS.auth.register,
  ROTAS.auth.forgot,
  ROTAS.auth.reset,
  ROTAS.auth.callback,
  ROTAS.legado.login,
  ROTAS.legado.cadastro,
];

/** Páginas legais (públicas, servidas também no domínio raiz). */
export const ROTAS_LEGAIS: readonly string[] = [
  ROTAS.termos,
  ROTAS.privacidade,
  ROTAS.cookies,
];

/** Uma rota pertence à área administrativa? */
export const ehRotaAdmin = (path: string): boolean =>
  path === ROTAS.admin || path.startsWith(`${ROTAS.admin}/`);
