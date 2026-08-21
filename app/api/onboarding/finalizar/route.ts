// Finaliza o onboarding obrigatório do primeiro acesso: popula FLUXO (setores) + materiais +
// produtos (sem preços) dos segmentos escolhidos e marca profileCompleto=true.
// Reusa popularSegmentos(comSetores:true). Idempotente (dedup por nome; não duplica).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { popularSegmentos } from '@/lib/seed/popularCatalogo'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  // Aceita segmentos[] (multi) ou o segmento único legado.
  const ids: string[] = Array.isArray(body?.segmentos) ? body.segmentos.map(String).filter(Boolean)
    : body?.segmento ? [String(body.segmento)] : []
  if (ids.length === 0) return NextResponse.json({ error: 'Escolha pelo menos um segmento' }, { status: 400 })

  let catalogo: Awaited<ReturnType<typeof popularSegmentos>> | null = null
  try {
    // comSetores:true → cria os setores de produção + materiais + produtos (sem preços) de cada segmento.
    catalogo = await popularSegmentos(workspaceId, ids, { comSetores: true })
  } catch (e) {
    console.error('[ONBOARDING/FINALIZAR] popularCatalogo falhou:', e)
    // Não trava o onboarding: mesmo sem catálogo, marca concluído (ela pode popular depois).
  }

  // Marca o perfil como completo (encerra o enforcement) + guarda os segmentos escolhidos.
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "profileCompleto" = true, "segmento" = ${ids[0]}, "segmentos" = ${JSON.stringify(ids)}, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}
  `
  await prisma.$executeRaw`UPDATE "User" SET "primeiroLogin" = false WHERE "id" = ${userId}`.catch(() => {})

  return NextResponse.json({ ok: true, catalogo })
}
