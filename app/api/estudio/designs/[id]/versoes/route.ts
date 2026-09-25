// SOA Edition — histórico de versões de um design (snapshots automáticos do autosave).
// GET            → lista (sem o JSON, leve): id, criadoEm, motivo, preview
// GET ?id=<vid>  → uma versão com o JSON (para restaurar no editor; restaurar = abrir + autosave)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const vid = req.nextUrl.searchParams.get('id')
  try {
    if (vid) {
      const [v] = await prisma.$queryRawUnsafe<unknown[]>(
        `SELECT "id","json","assetIds","criadoEm","motivo" FROM "EstudioDesignVersao" WHERE "id"=$1 AND "designId"=$2 AND "workspaceId"=$3`, vid, id, c.workspaceId)
      if (!v) return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })
      return NextResponse.json(serialize({ versao: v }))
    }
    const versoes = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT "id","criadoEm","motivo","previewUrl" FROM "EstudioDesignVersao" WHERE "designId"=$1 AND "workspaceId"=$2 ORDER BY "criadoEm" DESC LIMIT 30`, id, c.workspaceId)
    return NextResponse.json(serialize({ versoes }))
  } catch (e) {
    console.error('[ESTUDIO_VERSOES]', (e as Error).message)
    return NextResponse.json({ error: 'Não consegui ler o histórico' }, { status: 500 })
  }
}
