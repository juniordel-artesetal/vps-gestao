import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { ofertasPorNomes, registrarImpressaoOfertas } from '@/lib/parceiros/distribuidores'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'

// POST — recebe os nomes dos materiais da artesã e devolve as ofertas de parceiro
// casadas (match ÚNICO por nome normalizado). Registra impressão do que casou.
// body: { nomes: string[] }  →  { ofertas: { <nomeNormalizado>: Oferta } }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const b = await req.json().catch(() => ({}))
    const nomes: string[] = Array.isArray(b.nomes) ? b.nomes.slice(0, 500) : []
    if (nomes.length === 0) return NextResponse.json({ ofertas: {} })

    const ofertas = await ofertasPorNomes(nomes)
    const ids = Object.values(ofertas).map(o => o.produtoId)
    if (ids.length) await registrarImpressaoOfertas(ids)

    return NextResponse.json(serialize({ ofertas }))
  } catch (error) {
    console.error('[MATERIAIS] ofertas:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export { normNome }
