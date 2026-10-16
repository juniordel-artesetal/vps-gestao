// Master — dispara o e-mail do GRUPO DE SUPORTE das assinantes do SOA no WhatsApp (lib/avisos/grupoWhatsapp.ts).
// POST com header x-master-token (ou cookie master_token). ?seco=1 só conta quem receberia. Idempotente: disparar de
// novo só manda para quem ainda não recebeu.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { dispararEmailGrupo } from '@/lib/avisos/grupoWhatsapp'

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
    return NextResponse.json({ ok: true, ...(await dispararEmailGrupo({ seco: new URL(req.url).searchParams.get('seco') === '1' })) })
  } catch (e) {
    console.error('[MASTER/grupo-whatsapp]', e)
    return NextResponse.json({ error: 'Erro ao enviar o convite do grupo' }, { status: 500 })
  }
}
