import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { imprimir } from '@/lib/logistica'
import { moduloPostagemAtivo } from '@/lib/logistica/config'

export const dynamic = 'force-dynamic'

// GET — IMPRESSÃO UNIFICADA. Resolve a fonte do Envio (transportadora → PDF Melhor Envio;
// marketplace → etiqueta do canal, stub por ora) e devolve a URL do PDF.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId

    if (!await moduloPostagemAtivo(workspaceId))
      return NextResponse.json({ error: 'Módulo de Postagem desativado' }, { status: 403 })

    const [envio] = await prisma.$queryRaw`
      SELECT "id","fonte","provedor","provedorEnvioId","etiquetaUrl"
      FROM "Envio" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (!envio) return NextResponse.json({ error: 'Envio não encontrado' }, { status: 404 })

    const r = await imprimir(workspaceId, {
      fonte: envio.fonte, provedor: envio.provedor,
      provedorEnvioId: envio.provedorEnvioId, etiquetaUrl: envio.etiquetaUrl,
    })

    if (!r.ok) {
      const status = r.pendente ? 409 : 400
      return NextResponse.json({ error: r.erro || 'Etiqueta indisponível', pendente: r.pendente }, { status })
    }

    // Persiste a URL (best-effort) e devolve
    if (r.url && r.url !== envio.etiquetaUrl) {
      await prisma.$executeRaw`UPDATE "Envio" SET "etiquetaUrl" = ${r.url}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    return NextResponse.json({ ok: true, url: r.url })
  } catch (error) {
    console.error('[LOGISTICA] imprimir:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
