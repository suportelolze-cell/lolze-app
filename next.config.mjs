/** @type {import('next').NextConfig} */

/**
 * Cabeçalhos de segurança (auditoria 30/08/2026 — SEG-02).
 *
 * O app não tinha NENHUM cabeçalho de segurança. O risco mais direto era
 * clickjacking no /admin: qualquer site podia carregar o painel num iframe
 * invisível e induzir um clique em "excluir cliente" / "alterar e-mail".
 *
 * Todos os cabeçalhos abaixo são ENFORCED e não quebram nada do app atual:
 * - frame-ancestors/X-Frame-Options: o app não é embutido em lugar nenhum
 *   (nenhum <iframe> no repo além do que o Turnstile cria dentro da própria página).
 * - Permissions-Policy: câmera e localização NÃO são usadas; o MICROFONE é
 *   (áudio na Central de Atendimento, ChatWindow → getUserMedia), então fica
 *   liberado para a própria origem. Não trocar por microphone=() sem quebrar
 *   a gravação de áudio.
 *
 * A CSP fica em REPORT-ONLY de propósito: uma CSP errada quebra a aplicação em
 * produção em silêncio. Em report-only o navegador só registra a violação no
 * console. Depois de alguns dias navegando o app inteiro sem violação, trocar
 * a chave para "Content-Security-Policy" para passar a bloquear de verdade.
 */

// Origem do Supabase (API + realtime por WebSocket). Vem do env de build.
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_CRM_URL || "").replace(/\/+$/, "");
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' é exigido pelo bootstrap de hidratação do Next e pelo
  // script do pixel da Meta. Remover só com nonce por request.
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  // Fontes são locais (next/font/local): nenhum host externo.
  "font-src 'self'",
  `img-src 'self' data: blob: ${SUPABASE} https://www.facebook.com`,
  `media-src 'self' blob: ${SUPABASE}`,
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} https://connect.facebook.net`,
  // O Turnstile renderiza o desafio dentro de um iframe próprio.
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .filter(Boolean)
  .join("; ");

const nextConfig = {
  reactStrictMode: true,
  // pdf-parse lê arquivos em runtime; manter fora do bundle do servidor.
  // (Next 16 renomeou experimental.serverComponentsExternalPackages → serverExternalPackages.)
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    // Tree-shake pacotes grandes → bundles menores, carga mais rápida
    optimizePackageImports: ["lucide-react", "@xyflow/react", "@dnd-kit/core", "@dnd-kit/utilities"],
    // Cache de navegação no cliente: voltar a uma rota já visitada é instantâneo.
    // dynamic 60s = revisitar uma tela recém-vista não espera o servidor de novo
    // (as telas ao vivo, ex. Atendimento, têm realtime/poll próprios que atualizam).
    staleTimes: { dynamic: 60, static: 300 },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: ninguém embute o app (nem o /admin) num iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Impede o navegador de "adivinhar" o tipo de um arquivo servido.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa (com token) ao sair para outro site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 2 anos, subdomínios inclusos (app./admin.). Só HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // microfone LIBERADO (áudio no Atendimento); câmera e localização não.
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self), interest-cohort=()",
          },
          // Ver comentário no topo: trocar para "Content-Security-Policy" quando
          // o console ficar limpo em todas as telas.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
