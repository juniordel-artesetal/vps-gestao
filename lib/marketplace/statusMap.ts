// Mapa de status dos marketplaces → rótulo amigável PT-BR + grupo (cor/etapa). PURO (client-safe).
// A artesã nunca vê o código cru (ON_HOLD, IN_TRANSIT). Multi-canal: cada canal mapeia para os
// MESMOS grupos, então KPIs/filtros/linha do tempo funcionam igual para TikTok, ML e Shopee.
export type GrupoStatus = 'pendente' | 'producao' | 'enviado' | 'entregue' | 'cancelado' | 'outro'

interface Info { rotulo: string; grupo: GrupoStatus }

// TikTok Shop (enum confirmado na doc/loja de dev). Chaves em MAIÚSCULAS.
const TIKTOK: Record<string, Info> = {
  UNPAID: { rotulo: 'Aguardando pagamento', grupo: 'pendente' },
  ON_HOLD: { rotulo: 'Em espera', grupo: 'pendente' },
  AWAITING_SHIPMENT: { rotulo: 'A preparar / a enviar', grupo: 'producao' },
  PARTIALLY_SHIPPING: { rotulo: 'Envio parcial', grupo: 'enviado' },
  AWAITING_COLLECTION: { rotulo: 'Aguardando coleta', grupo: 'enviado' },
  IN_TRANSIT: { rotulo: 'A caminho', grupo: 'enviado' },
  DELIVERED: { rotulo: 'Entregue', grupo: 'entregue' },
  COMPLETED: { rotulo: 'Concluído', grupo: 'entregue' },
  CANCELLED: { rotulo: 'Cancelado', grupo: 'cancelado' },
  CANCEL: { rotulo: 'Cancelado', grupo: 'cancelado' },
}
const MAPAS: Record<string, Record<string, Info>> = { tiktokshop: TIKTOK }

/** Rótulo + grupo de um status cru. Fallback: usa heurística por palavra e nunca mostra vazio. */
export function rotuloStatus(canal: string | null | undefined, cru: string | null | undefined): Info {
  const c = String(cru || '').trim().toUpperCase()
  if (!c) return { rotulo: '—', grupo: 'outro' }
  const mapa = MAPAS[(canal || '').toLowerCase()] || TIKTOK
  if (mapa[c]) return mapa[c]
  // Heurística p/ variações não mapeadas (não quebra a UI; ainda esconde o código cru).
  if (/CANCEL|REFUND|RETURN/.test(c)) return { rotulo: 'Cancelado', grupo: 'cancelado' }
  if (/DELIVER|COMPLET/.test(c)) return { rotulo: 'Entregue', grupo: 'entregue' }
  if (/SHIP|TRANSIT|COLLECT/.test(c)) return { rotulo: 'A caminho', grupo: 'enviado' }
  if (/UNPAID|HOLD|PAYMENT/.test(c)) return { rotulo: 'Aguardando', grupo: 'pendente' }
  return { rotulo: c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' '), grupo: 'outro' }
}

// Classes Tailwind por grupo (badge). Definidas nos dois temas.
export const COR_GRUPO: Record<GrupoStatus, string> = {
  pendente: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  producao: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  enviado: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  entregue: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  cancelado: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  outro: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

// Filtro por grupo (dropdown amigável) → statuses crus que ele cobre (para o WHERE do backend).
export const GRUPOS_STATUS: { id: GrupoStatus; label: string }[] = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'producao', label: 'A preparar' },
  { id: 'enviado', label: 'Enviados / a caminho' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
]
export function statusCrusDoGrupo(canal: string, grupo: string): string[] {
  const mapa = MAPAS[(canal || 'tiktokshop').toLowerCase()] || TIKTOK
  return Object.entries(mapa).filter(([, v]) => v.grupo === grupo).map(([k]) => k)
}
