import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      // Método MAE (texto): o harfbuzzjs importa o built-in "module" só no ramo Node; no navegador vira vazio
      module: { browser: './lib/mae/texto/moduloVazio.ts' },
    },
  },
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
      // SOA Design: o Mockup foi retirado (30/09/2026) — links antigos voltam ao início do módulo.
      { source: '/estudio/mockups/:path*', destination: '/estudio', permanent: false },
      { source: '/master/estudio-cenas', destination: '/master', permanent: false },
    ]
  },
};

export default nextConfig;
