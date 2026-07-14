// Callback do OAuth do Google Drive. Valida state + Master, troca o code por tokens
// (refresh criptografado no banco) e volta pra tela de conexão. NUNCA loga token/code.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { conectarComCode } from '@/lib/googledrive'
import { validarState } from '../iniciar/route'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  const base = new URL('/master/google-drive', req.url)
  if (!await ehMaster()) { base.searchParams.set('erro', 'nao_autorizado'); return NextResponse.redirect(base) }

  const { searchParams } = new URL(req.url)
  const erroGoogle = searchParams.get('error')
  if (erroGoogle) { base.searchParams.set('erro', 'recusado'); return NextResponse.redirect(base) }

  const code = searchParams.get('code')
  if (!validarState(searchParams.get('state')) || !code) {
    base.searchParams.set('erro', 'state'); return NextResponse.redirect(base)
  }

  const r = await conectarComCode(code)
  if (!r.ok) { base.searchParams.set('erro', 'token'); return NextResponse.redirect(base) }
  base.searchParams.set('ok', '1')
  return NextResponse.redirect(base)
}
