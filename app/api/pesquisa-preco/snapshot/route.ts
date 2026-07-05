import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcularIndice, upsertSnapshot, avaliarAlertasParaNorm, seedHistoricoDeCompras } from '@/lib/indicePrecos'

export const dynamic = 'force-dynamic'

function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.MASTER_SECRET_TOKEN
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(req.url)
  return url.searchParams.get('secret') === secret
}

// GET/POST — job diário (Vercel Cron): snapshot dos materiais rastreados + avalia alertas.
// ?seed=1 → semeia o histórico a partir das compras de fornecedor.
async function handler(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  if (url.searchParams.get('seed') === '1') {
    const criados = await seedHistoricoDeCompras()
    return NextResponse.json({ ok: true, seed: criados })
  }

  // normNomes que vale a pena atualizar: já têm histórico OU têm alerta ativo
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT "normNome" FROM (
      SELECT "normNome" FROM "PrecoIndiceSnapshot"
      UNION
      SELECT "normNome" FROM "PesquisaAlerta" WHERE "ativo" = true
    ) x
    LIMIT 500
  ` as { normNome: string }[]

  let snapshots = 0, alertas = 0
  for (const r of rows) {
    try {
      const idx = await calcularIndice(r.normNome)
      if (idx.suficiente) { await upsertSnapshot(idx.normNome, idx.medio, idx.menor, idx.nFontes); snapshots++ }
      alertas += await avaliarAlertasParaNorm(r.normNome)
    } catch { }
  }
  return NextResponse.json({ ok: true, normNomes: rows.length, snapshots, alertasDisparados: alertas })
}

export const GET = handler
export const POST = handler
