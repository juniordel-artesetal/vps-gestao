// Mesmas linhas do relatório, em JSON — alimenta a página de impressão (→ PDF pelo navegador).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { linhasRelatorio, filtrosDaUrl, tituloRelatorio } from '@/lib/finRelatorio'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const url = new URL(req.url)
  const filtros = filtrosDaUrl(url)
  const { linhas, totais } = await linhasRelatorio(session.user.workspaceId, filtros)
  return NextResponse.json(serialize({
    linhas, totais,
    titulo: tituloRelatorio(filtros),
    workspaceNome: session.user.workspaceNome ?? '',
  }))
}
