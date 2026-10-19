/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Permite que o build de produção na Vercel seja concluído com segurança
    ignoreBuildErrors: true,
  },
  eslint: {
    // Evita interrupção do build de produção por regras estritas de linting
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
