// Rotina da campanha de migração (validação + régua). Manhã, dias úteis — ver vercel.json.
// CRON_SECRET (header Bearer, como a Vercel envia, ou ?secret=). Por padrão DRY-RUN:
// o envio real só com CAMPANHA_MIGRACAO_ATIVO=on E CAMPANHA_ASAAS_LINK definido.
import { NextRequest, NextResponse } from 'next/server'
import { rodarCampanha } from '@/lib/campanha/regua'

export const dynamic = 'force-dynamic'
// 300s (Pro): uma única invocação cobre as 130 mesmo na fase diária (D1–7), em que
// todas ficam "due" no mesmo dia e cada uma exige validação (Hotmart+Asaas). Com 60s
// só cabiam ~64 e a cauda ficava sem e-mail. Ver lib/campanha/regua.ts.
export const maxDuration = 300

async function handler(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1' ? true : undefined
  const r = await rodarCampanha({ dryRun })
  return NextResponse.json(r)
}

export const GET = handler
export const POST = handler
