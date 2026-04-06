import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/landing',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'vps-gestao.com.br',
          },
        ],
      },
      {
        source: '/',
        destination: '/landing',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'www.vps-gestao.com.br',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
