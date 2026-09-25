// Master — inicia o OAuth do Drive do ACERVO (conta de conteúdo da Naty). state assinado + nonce em cookie.
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { acervoConfigurado, iniciarOAuth } from '@/lib/estudio/acervoDrive'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await ehMaster(req))) return NextResponse.redirect(new URL('/master/login', req.url))
  if (!acervoConfigurado()) return NextResponse.redirect(new URL('/master/estudio-acervo?drive=indisponivel', req.url))
  const { url, nonce } = iniciarOAuth(new URL(req.url).origin)
  const res = NextResponse.redirect(url)
  res.cookies.set('acervo_nonce', nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/master/estudio/acervo', maxAge: 600 })
  return res
}
