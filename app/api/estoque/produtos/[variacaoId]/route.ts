import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — histórico de movimentações
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variacaoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { variacaoId } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT "id","tipo","quantidade","saldoApos",
           "motivo","referencia","usuarioNome","createdAt"
    FROM "EstProdutoMovimento"
    WHERE "workspaceId" = ${workspaceId}
      AND "variacaoId"  = ${variacaoId}
    ORDER BY "createdAt" DESC
    LIMIT 200
  ` as any[]

  return NextResponse.json(serialize(rows))
}

// PUT — atualiza estoque mínimo E campos customizados
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ variacaoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { variacaoId } = await params
  const workspaceId = session.user.workspaceId
  const { estoqueMinimo, camposValores } = await req.json()

  // Atualiza estoque mínimo via upsert no saldo
  if (estoqueMinimo !== undefined) {
    const saldoId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "EstProdutoSaldo"
        ("id","workspaceId","variacaoId","saldoAtual","estoqueMinimo","updatedAt")
      VALUES (${saldoId}, ${workspaceId}, ${variacaoId}, 0, ${Number(estoqueMinimo) || 0}, NOW())
      ON CONFLICT ("workspaceId","variacaoId")
      DO UPDATE SET
        "estoqueMinimo" = ${Number(estoqueMinimo) || 0},
        "updatedAt"     = NOW()
    `
  }

  // Salva valores dos campos customizados (upsert por campo)
  if (camposValores && typeof camposValores === 'object') {
    for (const [campoId, valor] of Object.entries(camposValores)) {
      const valorStr = String(valor ?? '')
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await prisma.$executeRaw`
        INSERT INTO "EstCampoValor"
          ("id","workspaceId","variacaoId","campoId","valor","updatedAt")
        VALUES (${id}, ${workspaceId}, ${variacaoId}, ${campoId}, ${valorStr}, NOW())
        ON CONFLICT ("workspaceId","variacaoId","campoId")
        DO UPDATE SET
          "valor"     = ${valorStr},
          "updatedAt" = NOW()
      `
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove produto do estoque (mantém histórico)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ variacaoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { variacaoId } = await params
  const workspaceId = session.user.workspaceId

  await prisma.$executeRaw`
    UPDATE "PrecVariacao"
    SET "incluirEstoque" = false
    WHERE "id" = ${variacaoId}
      AND EXISTS (
        SELECT 1 FROM "PrecProduto" p
        WHERE p."id" = "PrecVariacao"."produtoId"
          AND p."workspaceId" = ${workspaceId}
      )
  `

  return NextResponse.json({ ok: true })
}
