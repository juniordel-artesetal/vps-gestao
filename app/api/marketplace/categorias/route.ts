// Árvore de categorias do TikTok (para o seletor do bloco "Dados do Marketplace"). Gated + ADMIN.
// ⚠️ Depende da API real; sem conexão/erro → devolve lista vazia com aviso.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { buscarCategorias } from '@/lib/tiktok/catalogo'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  if (!(await marketplacesLiberado(session.user.workspaceId))) return NextResponse.json({ error: 'Módulo indisponível' }, { status: 404 })

  const r = await buscarCategorias(session.user.workspaceId)
  return NextResponse.json(serialize({ ok: r.ok, aviso: r.erro, categorias: r.categorias ?? [] }))
}
