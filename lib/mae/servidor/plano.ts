// Método MAE — PLANO da conta (Lote 7, item 120): SOA completo ou SÓ O MAE (vendido avulso).
//  • 'mae' = a venda do MAE avulso gravou mae_purchases (item_tipo 'plano', item_id 'mae-avulso'), ou a conta está
//    no env MAE_AVULSO_WORKSPACES (teste); sem isso, 'soa' (como todas as contas de hoje). Sem tocar em Workspace.
//  • 'soa': pedidos vêm do "Order" e o status vai para a etapa de Impressão da produção (item 119);
//    'mae': pedidos vêm de mae_orders (planilha da Shopee / cadastro manual) e o status é o do MAE (gerado/impresso).
import { prisma } from '@/lib/prisma'

export type PlanoMae = 'soa' | 'mae'
export const ITEM_PLANO_AVULSO = 'mae-avulso'

const lista = (v: string | undefined) => (v || '').split(',').map(s => s.trim()).filter(Boolean)

/** Regra pura: env de teste ou compra do avulso → 'mae'. */
export function planoDe(ws: string, envAvulso: string | undefined, comprouAvulso: boolean): PlanoMae {
  return lista(envAvulso).includes(ws) || comprouAvulso ? 'mae' : 'soa'
}

export async function planoMae(ws: string): Promise<PlanoMae> {
  if (planoDe(ws, process.env.MAE_AVULSO_WORKSPACES, false) === 'mae') return 'mae'
  try {
    const r = await prisma.$queryRaw<{ x: number }[]>`
      SELECT 1 AS x FROM mae_purchases WHERE workspace_id = ${ws} AND item_tipo = 'plano' AND item_id = ${ITEM_PLANO_AVULSO} LIMIT 1`
    return planoDe(ws, undefined, r.length > 0)
  } catch (e) {
    console.error('[MAE PLANO]', e)
    return 'soa'
  }
}

/** Id de pedido do MAE avulso (mae_orders) — o resto é "Order" do SOA. */
export const PREFIXO_PEDIDO_MAE = 'mo_'
export const ehPedidoMae = (id: string) => id.startsWith(PREFIXO_PEDIDO_MAE)
