// Método MAE — PEDIDOS para "Gerar arte" e "Edição em massa" (Sprint 12). Devolve, por pedido: os campos
// personalizados achatados (TEMA, NOME, IDADE… como estão em camposExtras), os itens com variação e
// produto (para o vínculo produto ↔ tema) e o histórico das artes geradas (mae_order_arts).
// ?id=<pedido> → só ele (card do pedido). Sem id → os pedidos em aberto (lista da edição em massa,
// que exige o add-on "Edição em massa").
// Lote 7 (item 120): a FONTE depende do plano — SOA completo lê o "Order"; só o MAE lê mae_orders (planilha da
// Shopee / cadastro manual). Pedido do MAE avulso tem id "mo_…". O SQL vive em lib/mae/servidor/fontes.ts.
import { NextRequest, NextResponse } from 'next/server'
import { serialize } from '@/lib/serialize'
import { contaMae } from '@/lib/mae/servidor/acesso'
import { planoMae, ehPedidoMae } from '@/lib/mae/servidor/plano'
import { listarSoa, listarMae, patchSoa, patchMae, temaEmMassaSoa, temaEmMassaMae } from '@/lib/mae/servidor/fontes'
import { temaValido } from '@/lib/mae/servidor/ajustesPedido'

export const dynamic = 'force-dynamic'

/**
 * Grava, só neste pedido: o tamanho do NOME/IDADE/HASHTAG/@ (`escalas`, não mexe no tema) e/ou — Lote 4
 * (item 43) — NOME, IDADE e TEMA preenchidos na lista da edição em massa (`campos`), no campo que o ateliê usa.
 * Lote 7 (item 116): `{ ids: [...], temaId }` = o mesmo tema em vários pedidos de uma vez.
 */
export async function PATCH(req: NextRequest) {
  const c = await contaMae({}); if (c instanceof NextResponse) return c
  try {
    const b = await req.json().catch(() => ({})) as Record<string, unknown>
    if (Array.isArray(b.ids)) {
      const ids = b.ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80).slice(0, 500)
      const temaId = temaValido(b.temaId)
      if (!ids.length || temaId === undefined) return NextResponse.json({ error: 'ids e temaId obrigatórios' }, { status: 400 })
      const n = (await temaEmMassaSoa(c.workspaceId, ids.filter(i => !ehPedidoMae(i)), temaId)) + (await temaEmMassaMae(c.workspaceId, ids.filter(ehPedidoMae), temaId))
      return NextResponse.json({ ok: true, atualizados: n })
    }
    const id = String(b.id ?? '')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const r = ehPedidoMae(id) ? await patchMae(c.workspaceId, id, b) : await patchSoa(c.workspaceId, id, b)
    return NextResponse.json(r.corpo, { status: r.status })
  } catch (e) {
    console.error('[MAE PEDIDOS PATCH]', e)
    return NextResponse.json({ error: 'Erro ao salvar o ajuste' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const c = await contaMae(id ? {} : { addon: 'massa' }); if (c instanceof NextResponse) return c
  try {
    const pedidos = id
      ? (ehPedidoMae(id) ? await listarMae(c.workspaceId, id) : await listarSoa(c.workspaceId, id))
      : (await planoMae(c.workspaceId)) === 'mae' ? await listarMae(c.workspaceId) : await listarSoa(c.workspaceId)
    if (id && !pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    return NextResponse.json(serialize({ pedidos }))
  } catch (e) {
    console.error('[MAE PEDIDOS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os pedidos' }, { status: 500 })
  }
}
