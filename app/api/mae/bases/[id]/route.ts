// Método MAE — uma base (mae_bases): a última versão, ou ?v=N.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contaMae, recusa } from '@/lib/mae/servidor/acesso'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  const v = Number(req.nextUrl.searchParams.get('v')) || null
  try {
    // proteção contra perda (12/10/2026): as versões salvas na nuvem, para restaurar uma anterior
    if (req.nextUrl.searchParams.get('versoes')) {
      const versoes = await prisma.$queryRaw<{ version: number; atualizado_em: Date }[]>`SELECT version, atualizado_em FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC`
      return NextResponse.json({ versoes: versoes.map(x => ({ versao: x.version, em: x.atualizado_em })) })
    }
    const linhas = v
      ? await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id} AND version = ${v}`
      : await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_bases WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC LIMIT 1`
    if (!linhas.length) return recusa('bases/[id]', { error: 'Base não encontrada' }, 404)
    return NextResponse.json({ doc: linhas[0].doc })
  } catch (e) {
    console.error('[MAE BASE GET]', e)
    return NextResponse.json({ error: 'Erro ao abrir a base' }, { status: 500 })
  }
}

// Lote 3 (item 35): excluir a base — só quando NENHUM tema da conta usa a base (os pedidos apontam para versões de
// tema; tema sem base não abriria). Usada → 409 com a quantidade e os NOMES dos temas.
// Lote 18 (item 226): temas da LIXEIRA não contam (o tema "já excluído" travava a base); a base vai para a lixeira
// (30 dias, `_lixeira` no doc). `?restaurar=1` tira da lixeira.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  try {
    if (req.nextUrl.searchParams.get('restaurar')) {
      await prisma.$executeRaw`UPDATE mae_bases SET doc = doc - '_lixeira' WHERE workspace_id = ${c.workspaceId} AND id = ${id}`
      return NextResponse.json({ ok: true })
    }
    const usos = await prisma.$queryRaw<{ id: string; nome: string | null }[]>`
      SELECT DISTINCT ON (id) id, nome FROM mae_themes
      WHERE workspace_id = ${c.workspaceId} AND base_id = ${id} AND NOT (doc ? '_lixeira')
      ORDER BY id, version DESC`
    if (usos.length) return recusa('bases/[id]', { error: `Esta base é usada em ${usos.length} tema(s): ${usos.slice(0, 8).map(t => t.nome ?? t.id).join(', ')}${usos.length > 8 ? '…' : ''}. Mova esses temas para outra base ou exclua-os antes.`, temas: usos.length, nomes: usos.map(t => t.nome ?? t.id) }, 409)
    await prisma.$executeRaw`UPDATE mae_bases SET doc = doc || jsonb_build_object('_lixeira', now()) WHERE workspace_id = ${c.workspaceId} AND id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE BASE DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir a base' }, { status: 500 })
  }
}
