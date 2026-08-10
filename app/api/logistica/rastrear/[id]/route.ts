import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { rastrear } from '@/lib/logistica'
import { moduloPostagemAtivo } from '@/lib/logistica/config'

export const dynamic = 'force-dynamic'

// GET — rastreio do envio (resolve pela fonte). Atualiza o código/status persistidos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId

    if (!await moduloPostagemAtivo(workspaceId))
      return NextResponse.json({ error: 'Módulo de Postagem desativado' }, { status: 403 })

    const [envio] = await prisma.$queryRaw`
      SELECT "id","fonte","provedor","provedorEnvioId","rastreio"
      FROM "Envio" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (!envio) return NextResponse.json({ error: 'Envio não encontrado' }, { status: 404 })

    const r = await rastrear(workspaceId, { fonte: envio.fonte, provedor: envio.provedor, provedorEnvioId: envio.provedorEnvioId })
    if (!r.ok) {
      const status = r.pendente ? 409 : 400
      return NextResponse.json({ error: r.erro || 'Rastreio indisponível', pendente: r.pendente }, { status })
    }

    if (r.rastreio && r.rastreio !== envio.rastreio) {
      await prisma.$executeRaw`UPDATE "Envio" SET "rastreio" = ${r.rastreio}, "status" = COALESCE(${r.status ?? null}, "status"), "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    return NextResponse.json(serialize({ ok: true, rastreio: r.rastreio, status: r.status, eventos: r.eventos || [] }))
  } catch (error) {
    console.error('[LOGISTICA] rastrear:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
