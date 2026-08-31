/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as respostas (SEG-02).
// Não incluímos Content-Security-Policy aqui de propósito: uma CSP estrita
// quebraria os scripts inline do Next e precisa de teste ponta a ponta próprio.
// Os abaixo são ganho seguro e sem efeito colateral conhecido.
const securityHeaders = [
  // Não deixa o site ser embutido em iframe de terceiros (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Navegador não "adivinha" o tipo do conteúdo (MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Só manda o domínio no Referer ao sair para outro site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desliga APIs sensíveis que o app não usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Força HTTPS por 2 anos (Vercel já serve só em HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  // pdf-parse lê arquivos em runtime; manter fora do bundle do servidor.
  // (Next 16 renomeou experimental.serverComponentsExternalPackages → serverExternalPackages.)
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Tree-shake pacotes grandes → bundles menores, carga mais rápida
    optimizePackageImports: ["lucide-react", "@xyflow/react", "@dnd-kit/core", "@dnd-kit/utilities"],
    // Cache de navegação no cliente: voltar a uma rota já visitada é instantâneo.
    // dynamic 60s = revisitar uma tela recém-vista não espera o servidor de novo
    // (as telas ao vivo, ex. Atendimento, têm realtime/poll próprios que atualizam).
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
