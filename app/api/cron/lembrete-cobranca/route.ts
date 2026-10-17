// Cron diário (10h de Brasília) — LEMBRETE DE COBRANÇA por WhatsApp (ver lib/whatsapp/lembreteCobranca.ts).
// GET: a Vercel (Authorization: Bearer CRON_SECRET). POST: rodar à mão (header x-master-token = MASTER_SECRET_TOKEN).
// ?seco=1 só calcula (não chama o Asaas, não envia) e devolve a prévia. Desligado enquanto WHATSAPP_ATIVO != on.
import { NextRequest, NextResponse } from 'next/server'
import { rodarLembreteCobranca } from '@/lib/whatsapp/lembreteCobranca'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function rodar(req: NextRequest) {
  const seco = new URL(req.url).searchParams.get('seco') === '1'
  try {
    return NextResponse.json({ ok: true, ...(await rodarLembreteCobranca({ seco })) })
  } catch (e) {
    console.error('[CRON LEMBRETE COBRANCA]', e)
    return NextResponse.json({ error: 'Erro no lembrete de cobrança' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return rodar(req)
}

export async function POST(req: NextRequest) {
  const t = req.headers.get('x-master-token')
  if (!process.env.MASTER_SECRET_TOKEN || t !== process.env.MASTER_SECRET_TOKEN) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return rodar(req)
}
