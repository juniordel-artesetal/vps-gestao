import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT { visivelLoja } — liga/desliga a visibilidade de UMA variação na loja.
// Só afeta variação de produto do próprio workspace (isolamento).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { visivelLoja } = await req.json()

    const res = await prisma.$executeRaw`
      UPDATE "PrecVariacao" v
      SET "visivelLoja" = ${!!visivelLoja}
      FROM "PrecProduto" p
      WHERE v."id" = ${id} AND v."produtoId" = p."id" AND p."workspaceId" = ${workspaceId}
    `
    if (!res) return NextResponse.json({ error: 'Variação não encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/vitrine/variacao PUT]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
