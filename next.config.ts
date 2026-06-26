import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        // Raiz ("/") dos domínios de marketing -> landing.
        // O Next casa o host com âncora (^...$), então este regex cobre
        // usesoa.com.br, www.usesoa.com.br, vps-gestao.com.br e www.vps-gestao.com.br,
        // mas NÃO casa app.vps-gestao.com.br (subdomínio do app continua indo pro login).
        // Só a rota "/" é afetada; /login, /landing etc. seguem normais.
        source: '/',
        has: [
          {
            type: 'host',
            value: '(www\\.)?(usesoa\\.com\\.br|vps-gestao\\.com\\.br)',
          },
        ],
        destination: '/landing',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
