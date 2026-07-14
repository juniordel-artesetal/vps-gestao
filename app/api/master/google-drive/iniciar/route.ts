// Inicia o OAuth do Google Drive (só Master). Redireciona pro consentimento do Google.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { credenciaisConfiguradas, urlAutorizacao } from '@/lib/googledrive'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export function assinarState(): string {
  const nonce = crypto.randomBytes(12).toString('hex')
  const sig = crypto.createHmac('sha256', process.env.MASTER_SECRET_TOKEN || '').update(nonce).digest('hex').slice(0, 24)
  return `${nonce}.${sig}`
}

export function validarState(state: string | null): boolean {
  if (!state || !state.includes('.')) return false
  const [nonce, sig] = state.split('.')
  const esperado = crypto.createHmac('sha256', process.env.MASTER_SECRET_TOKEN || '').update(nonce).digest('hex').slice(0, 24)
  return sig === esperado
}

export async function GET(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!credenciaisConfiguradas())
    return NextResponse.json({ error: 'Configure GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI no servidor.' }, { status: 400 })
  return NextResponse.redirect(urlAutorizacao(assinarState()))
}
