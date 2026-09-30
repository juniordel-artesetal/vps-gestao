// Master — ESTORNO de UMA cobrança específica do Asaas (devolução ao cartão) + auditoria.
// Para os casos que o estornarUltimoPagamento não cobre: cobrança de assinatura do CHECKOUT que nunca
// ganhou AsaasAssinatura (ex.: conta CANCELADA que seguiu sendo cobrada — bug corrigido em 30/09/2026).
// Guardas: o pagamento tem de ser DA workspace (externalReference = workspaceId ou checkoutSession =
// Workspace.checkoutId) e estar PAGO; estornado não estorna de novo. A chave Asaas nunca sai do servidor.
// Auth: header x-master-token ou cookie master_token (= MASTER_SECRET_TOKEN).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
let tabelaOk = false
async function ensureAuditoria() {
  if (tabelaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EstornoManual" (
      "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "paymentId" text NOT NULL UNIQUE,
      "subscriptionId" text, "valor" numeric(12,2), "status" text, "motivo" text, "por" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  tabelaOk = true
}

interface Pagamento { id: string; status?: string; value?: number; subscription?: string | null; externalReference?: string | null; checkoutSession?: string | null }

// POST { workspaceId, paymentId, motivo } — estorna a cobrança. Idempotente pelo paymentId.
export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const workspaceId = String(b?.workspaceId || '').trim(), paymentId = String(b?.paymentId || '').trim()
  const motivo = String(b?.motivo || '').trim().slice(0, 300)
  if (!workspaceId || !/^pay_[a-z0-9]+$/i.test(paymentId) || motivo.length < 5) {
    return NextResponse.json({ error: 'Informe workspaceId, paymentId (pay_…) e o motivo.' }, { status: 400 })
  }
  await ensureAuditoria()
  const [ja] = await prisma.$queryRaw`SELECT "status" FROM "EstornoManual" WHERE "paymentId" = ${paymentId}` as { status: string }[]
  if (ja) return NextResponse.json({ ok: true, jaEstornado: true, status: ja.status })

  const [ws] = await prisma.$queryRaw`SELECT "id", "checkoutId" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1` as { id: string; checkoutId: string | null }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  const g = await chamarAsaas<Pagamento>(`/payments/${paymentId}`)
  if (!g.ok || !g.dados?.id) return NextResponse.json({ error: g.erro || 'Pagamento não encontrado no Asaas' }, { status: 404 })
  const pag = g.dados
  const daWorkspace = pag.externalReference === ws.id || (!!ws.checkoutId && pag.checkoutSession === ws.checkoutId)
  if (!daWorkspace) return NextResponse.json({ error: 'Este pagamento não pertence a essa workspace — nada feito.' }, { status: 409 })
  if (!['RECEIVED', 'CONFIRMED'].includes(String(pag.status))) {
    return NextResponse.json({ error: `Pagamento em status ${pag.status} — só estorna pago (RECEIVED/CONFIRMED).` }, { status: 409 })
  }

  const r = await chamarAsaas<{ status?: string }>(`/payments/${paymentId}/refund`, { metodo: 'POST', corpo: { description: `SOA: ${motivo}`.slice(0, 200) } })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'O Asaas recusou o estorno.' }, { status: 502 })
  await prisma.$executeRaw`
    INSERT INTO "EstornoManual" ("id","workspaceId","paymentId","subscriptionId","valor","status","motivo","por","createdAt")
    VALUES (${gid()}, ${ws.id}, ${paymentId}, ${pag.subscription ?? null}, ${pag.value ?? null}, ${r.dados?.status ?? 'REFUND_REQUESTED'}, ${motivo}, 'master', NOW())
    ON CONFLICT ("paymentId") DO NOTHING
  `
  console.log(`[MASTER/estornar-cobranca] ws=${ws.id} pay=${paymentId} valor=${pag.value} → ${r.dados?.status}`)
  return NextResponse.json({ ok: true, paymentId, valor: pag.value, status: r.dados?.status ?? 'REFUND_REQUESTED' })
}
