// Master — dispara o LEMBRETE PÓS-LIVE da oferta do Método Mãe (lib/mae/assinatura/emailPosLive.ts) para as assinantes
// ATIVAS do SOA sem o MAE. POST com x-master-token (ou cookie master_token). ?seco=1 só conta. Idempotente.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { dispararEmailPosLive } from '@/lib/mae/assinatura/emailPosLive'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await dispararEmailPosLive({ seco: new URL(req.url).searchParams.get('seco') === '1' })) })
  } catch (e) {
    console.error('[MASTER/mae-pos-live]', e)
    return NextResponse.json({ error: 'Erro ao enviar o lembrete pós-live' }, { status: 500 })
  }
}
