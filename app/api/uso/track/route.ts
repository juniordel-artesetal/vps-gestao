// Beacon de uso (chamado pela casca autenticada a cada troca de módulo). Registra
// uso agregado por módulo/dia do workspace da SESSÃO. Sem sessão → 204 silencioso
// (não polui log nem quebra a navegação). Nunca guarda conteúdo/dado pessoal.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { moduloDaRota, registrarUso } from '@/lib/usoLog'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.workspaceId) return new NextResponse(null, { status: 204 })

    const b = await req.json().catch(() => ({}))
    const modulo = moduloDaRota(String(b.path || ''))
    if (!modulo) return new NextResponse(null, { status: 204 })

    await registrarUso(session.user.workspaceId, modulo)
    return new NextResponse(null, { status: 204 })
  } catch {
    // Tracking nunca pode atrapalhar o uso do sistema.
    return new NextResponse(null, { status: 204 })
  }
}
