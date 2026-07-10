import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — serve os bytes da imagem (preview no admin). Autenticado + escopo do workspace.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse(null, { status: 401 })
    const { id } = await params
    const [row] = await prisma.$queryRaw`
      SELECT "imagem" FROM "LojaImagem" WHERE "id" = ${id} AND "workspaceId" = ${session.user.workspaceId} LIMIT 1
    ` as { imagem: string | null }[]
    const dataUrl = row?.imagem
    if (!dataUrl) return new NextResponse(null, { status: 404 })
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return new NextResponse(null, { status: 404 })
    const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
    return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=30' } })
  } catch (e) {
    console.error('[config/loja/imagens/[id] GET]', e)
    return new NextResponse(null, { status: 500 })
  }
}

// PUT { ordem?, capa? } — reordenar / definir capa (capa desmarca as irmãs do mesmo dono)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { ordem, capa } = await req.json()

    const [img] = await prisma.$queryRaw`
      SELECT "id","produtoId","variacaoId" FROM "LojaImagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as { id: string; produtoId: string | null; variacaoId: string | null }[]
    if (!img) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    if (ordem !== undefined) {
      await prisma.$executeRaw`UPDATE "LojaImagem" SET "ordem" = ${Number(ordem) || 0} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (capa === true) {
      // desmarca as irmãs do mesmo dono, marca esta
      if (img.produtoId) {
        await prisma.$executeRaw`UPDATE "LojaImagem" SET "capa" = false WHERE "produtoId" = ${img.produtoId} AND "workspaceId" = ${workspaceId}`
      } else if (img.variacaoId) {
        await prisma.$executeRaw`UPDATE "LojaImagem" SET "capa" = false WHERE "variacaoId" = ${img.variacaoId} AND "workspaceId" = ${workspaceId}`
      }
      await prisma.$executeRaw`UPDATE "LojaImagem" SET "capa" = true WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/imagens/[id] PUT]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove; se era a capa, promove a próxima (menor ordem) a capa.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [img] = await prisma.$queryRaw`
      SELECT "id","produtoId","variacaoId","capa" FROM "LojaImagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as { id: string; produtoId: string | null; variacaoId: string | null; capa: boolean }[]
    if (!img) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    await prisma.$executeRaw`DELETE FROM "LojaImagem" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (img.capa) {
      const col = img.produtoId ? 'produtoId' : 'variacaoId'
      const dono = img.produtoId || img.variacaoId
      const [prox] = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "LojaImagem" WHERE "${col}" = $1 ORDER BY "ordem" ASC, "createdAt" ASC LIMIT 1`, dono
      ) as { id: string }[]
      if (prox) await prisma.$executeRaw`UPDATE "LojaImagem" SET "capa" = true WHERE "id" = ${prox.id}`
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/imagens/[id] DELETE]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
