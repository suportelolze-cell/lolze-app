/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdf-parse lê arquivos em runtime; manter fora do bundle do servidor
    serverComponentsExternalPackages: ["pdf-parse"],
    // Tree-shake pacotes grandes → bundles menores, carga mais rápida
    optimizePackageImports: ["lucide-react", "@xyflow/react"],
    // Cache de navegação no cliente: voltar a uma rota já visitada é instantâneo
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
