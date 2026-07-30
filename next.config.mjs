/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse lê arquivos em runtime; manter fora do bundle do servidor.
  // (Next 16 renomeou experimental.serverComponentsExternalPackages → serverExternalPackages.)
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    // Tree-shake pacotes grandes → bundles menores, carga mais rápida
    optimizePackageImports: ["lucide-react", "@xyflow/react", "@dnd-kit/core", "@dnd-kit/utilities"],
    // Cache de navegação no cliente: voltar a uma rota já visitada é instantâneo
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
