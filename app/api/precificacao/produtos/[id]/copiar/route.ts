import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { copiarProduto } from '@/lib/copiarProduto'

// POST — copia produto com todas as suas variações e materiais (nome = "<nome> (cópia)")
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [orig] = await prisma.$queryRaw`SELECT "nome" FROM "PrecProduto" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
    if (!orig) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const res = await copiarProduto({ workspaceId, baseId: id, novoNome: `${orig.nome} (cópia)` })
    if (!res) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    return NextResponse.json({ ok: true, novoProdutoId: res.novoProdutoId, nome: res.nome })
  } catch (err) {
    console.error('[POST copiar produto]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
