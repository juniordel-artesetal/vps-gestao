// Preço de MERCADO (índice crowd) por nome de material — para o indicador "boa compra"
// no Pedido de compra. Reusa calcularIndice (mesma fonte da pesquisa de preço).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { calcularIndice } from '@/lib/indicePrecos'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const nomes: string[] = Array.isArray(body?.nomes) ? body.nomes.slice(0, 30) : []
  const mercado: Record<string, { medio: number; confiabilidade: string } | null> = {}
  await Promise.all([...new Set(nomes.map(String))].map(async nome => {
    try {
      const idx: any = await calcularIndice(nome)
      mercado[normNome(nome)] = idx?.suficiente ? { medio: idx.medio, confiabilidade: idx.confiabilidade } : null
    } catch { mercado[normNome(nome)] = null }
  }))
  return NextResponse.json(serialize({ mercado }))
}
