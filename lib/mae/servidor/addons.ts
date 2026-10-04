// Método MAE — ADD-ONS "Criação de artes MAE" e "Edição em massa" (Sprint 12) e compras da Loja da Naty.
//
// Entitlement por CONTA (workspace), como os outros add-ons do SOA, mas SEM mexer na tabela Workspace
// (tabela quente; regra anti-lock-storm): o direito fica em mae_purchases (item_tipo 'addon'):
//   • beta (MAE_BETA_WORKSPACES) → os dois liberados, origem 'beta';
//   • linha em mae_purchases ('addon', 'criacao'|'massa') → liberado (cortesia do Master ou compra).
// PREÇO: env MAE_ADDON_CRIACAO_PRECO / MAE_ADDON_MASSA_PRECO (reais). Sem valor = "em breve" e NÃO cobra
// (decisão do Júnior em aberto).
//
// Compra AVULSA de pack/preset da Loja: cobrança no Asaas com externalReference
// "MAE:<workspaceId>:<tipo>:<itemId>:<compraId>"; só o WEBHOOK confirmado grava a linha em mae_purchases
// (id = compraId; idempotente). Estorno/chargeback apaga a linha.
import { prisma } from '@/lib/prisma'

export type Addon = 'criacao' | 'massa'
export interface EstadoAddon { ativo: boolean; origem: 'beta' | 'cortesia' | 'compra' | null; preco: number | null }

const lista = (v: string | undefined) => (v || '').split(',').map(s => s.trim()).filter(Boolean)
export const noBeta = (ws: string) => { const b = lista(process.env.MAE_BETA_WORKSPACES); return b.includes('*') || b.includes(ws) }
/** Conta da Naty (publica packs e presets na Loja). */
export const ehNaty = (ws: string) => lista(process.env.MAE_NATY_WORKSPACES).includes(ws)

export function precoAddon(a: Addon): number | null {
  const v = Number(String((a === 'criacao' ? process.env.MAE_ADDON_CRIACAO_PRECO : process.env.MAE_ADDON_MASSA_PRECO) ?? '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export async function addonsDaConta(workspaceId: string): Promise<Record<Addon, EstadoAddon>> {
  const out: Record<Addon, EstadoAddon> = {
    criacao: { ativo: false, origem: null, preco: precoAddon('criacao') },
    massa: { ativo: false, origem: null, preco: precoAddon('massa') },
  }
  if (noBeta(workspaceId)) { out.criacao = { ...out.criacao, ativo: true, origem: 'beta' }; out.massa = { ...out.massa, ativo: true, origem: 'beta' } }
  try {
    const rows = await prisma.$queryRaw<{ item_id: string; id: string }[]>`
      SELECT item_id, id FROM mae_purchases WHERE workspace_id = ${workspaceId} AND item_tipo = 'addon' AND item_id IN ('criacao','massa')`
    for (const r of rows) {
      const a = r.item_id as Addon
      if (!out[a].ativo) out[a] = { ...out[a], ativo: true, origem: r.id.startsWith('cortesia_') ? 'cortesia' : 'compra' }
    }
  } catch (e) { console.error('[MAE ADDONS]', e) }
  // Edição em massa é um add-on POR CIMA da Criação de artes
  if (!out.criacao.ativo) out.massa = { ...out.massa, ativo: false }
  return out
}

// ── compras da Loja (Asaas) ────────────────────────────────────────────────────────────────────
export const MARCA_MAE = 'MAE:'
export const ehExternalRefMae = (ref: unknown): boolean => typeof ref === 'string' && ref.startsWith(MARCA_MAE)

/** Evento do Asaas de uma compra da Loja: pago → grava a compra (uma vez); estorno → retira. */
export async function aplicarEventoMae(evento: string, ref: string): Promise<boolean> {
  const partes = ref.slice(MARCA_MAE.length).split(':')
  if (partes.length !== 4) return false
  const [workspaceId, tipo, itemId, compraId] = partes
  if (!['pack', 'preset'].includes(tipo)) return false
  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    await prisma.$executeRaw`
      INSERT INTO mae_purchases (id, workspace_id, item_tipo, item_id) VALUES (${compraId}, ${workspaceId}, ${tipo}, ${itemId})
      ON CONFLICT (id) DO NOTHING`
    console.log(`[MAE-LOJA] paga ${tipo}=${itemId} ws=${workspaceId}`)
    return true
  }
  if (evento === 'PAYMENT_REFUNDED' || evento === 'PAYMENT_CHARGEBACK_REQUESTED') {
    await prisma.$executeRaw`DELETE FROM mae_purchases WHERE id = ${compraId} AND workspace_id = ${workspaceId}`
    return true
  }
  return true   // outros eventos (vencida, apagada…): nada a fazer — a compra só existe quando paga
}
