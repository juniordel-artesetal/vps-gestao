// Método MAE — um tema (mae_themes): a última versão, ou ?v=N.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contaMae } from '@/lib/mae/servidor/acesso'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  const v = Number(req.nextUrl.searchParams.get('v')) || null
  try {
    const linhas = v
      ? await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${id} AND version = ${v}`
      : await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC LIMIT 1`
    if (!linhas.length) return NextResponse.json({ error: 'Tema não encontrado' }, { status: 404 })
    return NextResponse.json({ doc: linhas[0].doc })
  } catch (e) {
    console.error('[MAE TEMA GET]', e)
    return NextResponse.json({ error: 'Erro ao abrir o tema' }, { status: 500 })
  }
}
