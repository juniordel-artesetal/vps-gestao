// app/api/clientes/match/route.ts — candidatos de cliente por comprador (importação de pedidos) — VPS-20260630-NQA8
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome as norm, soDigitos } from '@/lib/normNome'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const body = await req.json()
  const compradores: any[] = Array.isArray(body?.compradores) ? body.compradores : []
  if (compradores.length === 0) return NextResponse.json({ resultado: [] })

  const clientes = await prisma.$queryRaw`
    SELECT "id", "nome", "telefone" FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
  ` as { id: string; nome: string; telefone: string | null }[]

  const porNome = new Map<string, { id: string; nome: string; telefone: string | null }[]>()
  for (const c of clientes) {
    const k = norm(c.nome)
    if (!porNome.has(k)) porNome.set(k, [])
    porNome.get(k)!.push(c)
  }

  const resultado = compradores.map((cp) => {
    const nome = String(cp?.nome ?? '')
    const tel = soDigitos(cp?.telefone)
    const cands = porNome.get(norm(nome)) || []
    let sugestao: 'vincular' | 'criar' | 'naovincular' = 'criar'
    let clienteId: string | null = null

    if (cands.length === 1) {
      sugestao = 'vincular'; clienteId = cands[0].id
    } else if (cands.length > 1) {
      // Múltiplos com mesmo nome → só desempata se o telefone bater em exatamente um
      const porTel = tel ? cands.filter(c => soDigitos(c.telefone) === tel) : []
      if (porTel.length === 1) { sugestao = 'vincular'; clienteId = porTel[0].id }
      else { sugestao = 'naovincular' } // ambíguo → usuária decide
    }

    return { nome, candidatos: cands.map(c => ({ id: c.id, nome: c.nome })), sugestao, clienteId }
  })

  return NextResponse.json({ resultado })
}
