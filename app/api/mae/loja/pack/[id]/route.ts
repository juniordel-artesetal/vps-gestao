// Método MAE — o PACK completo (receita + links dos arquivos) para quem tem: grátis, comprado, ou a Naty.
// O navegador baixa os arquivos para "Packs Naty/" na Biblioteca dela.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contaMae } from '@/lib/mae/servidor/acesso'
import { ehNaty } from '@/lib/mae/servidor/addons'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await ctx.params
  try {
    const [p] = await prisma.$queryRaw<{ doc: { loja?: { precoCentavos?: number | null } } }[]>`
      SELECT doc FROM mae_themes WHERE workspace_id = 'naty' AND publicado AND id = ${id} ORDER BY version DESC LIMIT 1`
    if (!p) return NextResponse.json({ error: 'Pack não encontrado' }, { status: 404 })
    const preco = p.doc.loja?.precoCentavos ?? null
    if (preco && !ehNaty(c.workspaceId)) {
      const [ja] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM mae_purchases WHERE workspace_id = ${c.workspaceId} AND item_tipo = 'pack' AND item_id = ${id} LIMIT 1`
      if (!ja) return NextResponse.json({ error: 'Compre o pack para baixar' }, { status: 402 })
    }
    return NextResponse.json({ doc: p.doc })
  } catch (e) {
    console.error('[MAE LOJA PACK]', e)
    return NextResponse.json({ error: 'Erro ao abrir o pack' }, { status: 500 })
  }
}
