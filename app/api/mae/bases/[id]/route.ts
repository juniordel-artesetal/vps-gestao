// Método MAE — uma base (mae_bases): a última versão, ou ?v=N.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contaMae } from '@/lib/mae/servidor/acesso'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  const v = Number(req.nextUrl.searchParams.get('v')) || null
  try {
    const linhas = v
      ? await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id} AND version = ${v}`
      : await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC LIMIT 1`
    if (!linhas.length) return NextResponse.json({ error: 'Base não encontrada' }, { status: 404 })
    return NextResponse.json({ doc: linhas[0].doc })
  } catch (e) {
    console.error('[MAE BASE GET]', e)
    return NextResponse.json({ error: 'Erro ao abrir a base' }, { status: 500 })
  }
}

// Lote 3 (item 35): excluir a base (todas as versões) — só quando NENHUM tema da conta usa a base
// (os pedidos apontam para versões de tema; tema sem base não abriria). Usada → 409 com a quantidade.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  try {
    const usos = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(DISTINCT id) AS n FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND base_id = ${id}`
    const n = Number(usos[0]?.n ?? 0)
    if (n > 0) return NextResponse.json({ error: `Esta base é usada em ${n} tema(s). Exclua ou troque a base desses temas antes.`, temas: n }, { status: 409 })
    await prisma.$executeRaw`DELETE FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE BASE DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir a base' }, { status: 500 })
  }
}
