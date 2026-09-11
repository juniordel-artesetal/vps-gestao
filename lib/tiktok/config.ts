// Config central dos endpoints do TikTok Shop (Partner API), lida do ENV com defaults
// de PRODUÇÃO. Trocar aqui (ou por env) se o TikTok mudar as bases.
//
// ⚠️ NÃO existe URL de sandbox separada: a loja de DESENVOLVIMENTO roda no mesmo pool
// de PRODUÇÃO. O isolamento vem de autorizar a loja de teste — por isso as bases
// abaixo são as de produção mesmo em ambiente de testes.
//
// Bases (confirmadas na doc atual do TikTok Shop Partner Center):
//   • services  → página de autorização do vendedor (open/authorize)
//   • auth      → troca e refresh de token (/api/v2/token/get, /api/v2/token/refresh)
//   • api       → chamadas open-api (orders, products, shops)
export const TIKTOK_ENDPOINTS = {
  servicesBase: process.env.TIKTOK_SERVICES_BASE || 'https://services.tiktokshop.com',
  authBase: process.env.TIKTOK_AUTH_BASE || 'https://auth.tiktok-shops.com',
  apiBase: process.env.TIKTOK_API_BASE || 'https://open-api.tiktokglobalshop.com',
} as const
