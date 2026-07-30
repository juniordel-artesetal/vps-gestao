// Selo/legenda visual do canal — cor + nome + ícone consistentes em TODO o sistema.
// Puro (client/server). Classes Tailwind ESTÁTICAS (o JIT não gera cores dinâmicas).
// Aceita slug ('shopee','ml','tiktok'…) OU nome completo ('Mercado Livre','Loja').
export interface CanalVisual { label: string; emoji: string; classe: string }

export function canalVisual(canal?: string | null, sub?: string | null, labelCustom?: string | null): CanalVisual {
  const c = String(canal || 'shopee').trim().toLowerCase()
  if (c === 'shopee')
    return { label: 'Shopee', emoji: '🛒', classe: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' }
  if (c === 'ml' || c === 'mercadolivre' || c === 'mercado livre')
    return { label: sub === 'premium' ? 'ML Premium' : 'Mercado Livre', emoji: '🟡', classe: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' }
  if (c === 'tiktok' || c === 'tiktokshop' || c === 'tiktok shop')
    return { label: 'TikTok Shop', emoji: '🎵', classe: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800' }
  if (c === 'amazon')
    return { label: 'Amazon', emoji: '📦', classe: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' }
  if (c === 'magalu')
    return { label: 'Magalu', emoji: '🛍️', classe: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' }
  if (c === 'direta' || c === 'propria' || c === 'loja' || c === 'venda direta' || c === 'loja própria')
    return { label: c === 'loja' ? 'Loja' : 'Loja própria', emoji: '🏠', classe: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' }
  // canal próprio/custom — nome + cor neutra
  return { label: labelCustom || String(canal || '—'), emoji: '🏷️', classe: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' }
}
