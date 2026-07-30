/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
