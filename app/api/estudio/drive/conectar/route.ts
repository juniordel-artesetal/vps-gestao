// SOA Edition — inicia o OAuth do Drive DELA. state assinado + nonce em cookie httpOnly (anti-CSRF).
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { driveConfigurado, criarState, urlAutorizacao } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const volta = new URL('/estudio/arquivos', req.url)
  if (!driveConfigurado()) { volta.searchParams.set('drive', 'indisponivel'); return NextResponse.redirect(volta) }
  const { state, nonce } = criarState(c.userId)
  const res = NextResponse.redirect(urlAutorizacao(state, new URL(req.url).origin))
  res.cookies.set('estudio_drive_nonce', nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/estudio/drive', maxAge: 600 })
  return res
}
