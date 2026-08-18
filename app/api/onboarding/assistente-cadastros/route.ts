// Assistente de Cadastros (assinante ATUAL): popula materiais + produtos dos segmentos
// escolhidos, SEM preços e SEM mexer no fluxo/setores. Dedup por nome; idempotente.
// GET lista os segmentos disponíveis (resumo p/ a UI). POST popula.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { logError } from '@/lib/errorLog'
import { resumoSegmentos } from '@/lib/seed/catalogoSegmentos'
import { popularSegmentos } from '@/lib/seed/popularCatalogo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  return NextResponse.json(serialize({ segmentos: resumoSegmentos() }))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.segmentos) ? body.segmentos.map(String).filter(Boolean) : []
  if (ids.length === 0) return NextResponse.json({ error: 'Escolha ao menos um segmento' }, { status: 400 })

  try {
    // comSetores = false: NÃO altera o fluxo de produção de quem já opera.
    const r = await popularSegmentos(session.user.workspaceId, ids, { comSetores: false })
    return NextResponse.json(serialize({
      ok: true,
      produtosCriados: r.produtosCriados,
      produtosPulados: r.produtosPulados,
      materiaisCriados: r.materiaisCriados,
      materiaisReusados: r.materiaisReusados,
      segmentos: r.segmentos,
      ignorados: r.ignorados,
    }))
  } catch (error: any) {
    console.error('[ONBOARDING/ASSISTENTE-CADASTROS] falha ao popular:', error)
    await logError({ workspaceId: session.user.workspaceId, rota: '/api/onboarding/assistente-cadastros', metodo: 'POST', erro: error })
    return NextResponse.json({ error: 'Não foi possível popular o catálogo. Tente novamente.' }, { status: 500 })
  }
}
