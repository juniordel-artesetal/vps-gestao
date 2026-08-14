// Master — registra o webhook do bot dedicado do Pessoal (setWebhook) quando o token existir.
// GET = status (getWebhookInfo) · POST = registra. Roda em prod → usa o token do .env de prod.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { botConfigurado, registrarWebhook, infoWebhook } from '@/lib/pessoal/telegram'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

async function master(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  return (await cookies()).get('master_token')?.value === seg
}

export async function GET(req: NextRequest) {
  if (!(await master(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!botConfigurado()) return NextResponse.json({ botConfigurado: false, aviso: 'Defina TELEGRAM_PESSOAL_BOT_TOKEN no .env' })
  const info = await infoWebhook()
  return NextResponse.json({ botConfigurado: true, webhook: info.result ?? null, erro: info.erro ?? null })
}

export async function POST(req: NextRequest) {
  if (!(await master(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!botConfigurado()) return NextResponse.json({ error: 'TELEGRAM_PESSOAL_BOT_TOKEN ausente no .env' }, { status: 400 })
  const base = baseUrlDeHeaders(req.headers)
  const r = await registrarWebhook(base)
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao registrar' }, { status: 400 })
  return NextResponse.json({ ok: true, url: `${base}/api/pessoal/telegram/webhook` })
}
