import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — define os campos de vitrine de UM produto (coleção, ordem, destaque, imagemLoja).
// Só campos enviados são alterados. Não toca custo/margem/preço.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { lojaColecaoId, lojaOrdem, lojaDestaque, imagemLoja } = await req.json()

  const exists = await prisma.$queryRaw`
    SELECT "id" FROM "PrecProduto" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  ` as any[]
  if (!exists.length) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  if (lojaColecaoId !== undefined) {
    // Valida que a coleção pertence ao mesmo workspace (evita vínculo cruzado)
    let colId: string | null = null
    if (lojaColecaoId) {
      const col = await prisma.$queryRaw`
        SELECT "id" FROM "LojaColecao" WHERE "id" = ${lojaColecaoId} AND "workspaceId" = ${workspaceId}
      ` as any[]
      colId = col.length ? lojaColecaoId : null
    }
    await prisma.$executeRaw`UPDATE "PrecProduto" SET "lojaColecaoId"=${colId} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  }
  if (lojaOrdem !== undefined)
    await prisma.$executeRaw`UPDATE "PrecProduto" SET "lojaOrdem"=${Number(lojaOrdem) || 0} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (lojaDestaque !== undefined)
    await prisma.$executeRaw`UPDATE "PrecProduto" SET "lojaDestaque"=${Boolean(lojaDestaque)} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (imagemLoja !== undefined)
    await prisma.$executeRaw`UPDATE "PrecProduto" SET "imagemLoja"=${imagemLoja ? String(imagemLoja) : null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

  return NextResponse.json({ ok: true })
}
