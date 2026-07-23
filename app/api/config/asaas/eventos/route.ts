import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { reprocessarPendentes } from '@/lib/pagamento/asaas/webhook'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — últimos eventos recebidos, para auditoria na tela do Master.
// NÃO devolve o payload: mesmo mascarado, não há razão de trafegá-lo para a tela.
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const eventos = await prisma.$queryRaw`
    SELECT "id", "eventoId", "evento", "pagamentoRef", "assinaturaRef", "erro",
           TO_CHAR("createdAt",    'DD/MM/YYYY HH24:MI') AS "recebidoEm",
           TO_CHAR("processadoEm", 'DD/MM/YYYY HH24:MI') AS "processadoEm"
    FROM "AsaasWebhookEvento"
    ORDER BY "createdAt" DESC
    LIMIT 30
  `

  const [pend] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "pendentes"
    FROM "AsaasWebhookEvento" WHERE "processadoEm" IS NULL
  ` as { pendentes: number }[]

  return NextResponse.json(serialize({ eventos, pendentes: pend?.pendentes ?? 0 }))
}

// POST — reprocessa os eventos que ficaram pendentes (tipicamente recebidos com a
// feature flag OFF). Sem esta ação eles virariam órfãos: o Asaas não reenvia depois
// que respondemos 200.
export async function POST() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const r = await reprocessarPendentes()
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[ASAAS-REPROC]', (e as Error)?.message)
    return NextResponse.json({ ok: false, erro: 'Falha ao reprocessar.' }, { status: 500 })
  }
}
