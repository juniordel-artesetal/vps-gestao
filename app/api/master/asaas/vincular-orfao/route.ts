// Master — pagamentos Asaas ÓRFÃOS (pagos sem workspace vinculado). GET lista; POST vincula+ativa.
// Auth: cookie master_token (mesmo padrão das outras rotas Master). Sem SELECT *.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { vincularOrfao } from '@/lib/assinatura/vincularOrfao'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — eventos marcados como órfãos pelo webhook (pagamento pago sem workspace).
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "eventoId", "evento", "assinaturaRef" AS subscription, "pagamentoRef" AS payment,
           TO_CHAR("createdAt",'YYYY-MM-DD"T"HH24:MI') AS "createdAt", "erro"
    FROM "AsaasWebhookEvento"
    WHERE "erro" LIKE 'ÓRFÃO_PAGO:%'
    ORDER BY "createdAt" DESC LIMIT 100
  `
  return NextResponse.json(serialize({ orfaos: rows }))
}

// POST { subscriptionId, workspaceId } — cria a AsaasAssinatura e ativa o acesso. Idempotente.
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const subscriptionId = String(b?.subscriptionId || '').trim()
  const workspaceId = String(b?.workspaceId || '').trim()
  if (!subscriptionId || !workspaceId) return NextResponse.json({ error: 'Informe subscriptionId e workspaceId' }, { status: 400 })
  try {
    const r = await vincularOrfao(workspaceId, subscriptionId)
    return NextResponse.json(serialize(r), { status: r.ok ? 200 : 400 })
  } catch (e: any) {
    console.error('[MASTER/vincular-orfao]', e?.message)
    return NextResponse.json({ error: 'Falha ao vincular', detalhe: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}
