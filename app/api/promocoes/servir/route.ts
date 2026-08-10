import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { servirPromocao } from '@/lib/parceiros/distribuidores'

export const dynamic = 'force-dynamic'

// GET — serve UMA promoção elegível pro assinante (teto 2x/dia + rotação por prioridade).
// Registra a exibição/impressão. Retorna null quando nada elegível.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ promocao: null })
    const promo = await servirPromocao(session.user.workspaceId)
    return NextResponse.json(serialize({ promocao: promo }))
  } catch (error) {
    console.error('[PROMOCOES] servir:', error)
    return NextResponse.json({ promocao: null })
  }
}
