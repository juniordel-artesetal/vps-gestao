// SOA Edition — retorno do OAuth do Drive dela. Valida state (assinatura + login + nonce do cookie),
// troca o code por tokens (cifrados) e volta para Meus arquivos. Nunca loga code/token.
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { validarState, conectar } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const volta = new URL('/estudio/arquivos', req.url)
  const fim = (r: string) => {
    volta.searchParams.set('drive', r)
    const res = NextResponse.redirect(volta)
    res.cookies.set('estudio_drive_nonce', '', { path: '/api/estudio/drive', maxAge: 0 })
    return res
  }
  const c = await ctxEstudio(); if (!c.ok) return fim('sessao')
  const q = new URL(req.url).searchParams
  if (q.get('error')) return fim('recusado')
  const code = q.get('code')
  if (!code || !validarState(q.get('state'), c.userId, req.cookies.get('estudio_drive_nonce')?.value)) return fim('state')
  const r = await conectar(c.workspaceId, c.userId, code, new URL(req.url).origin)
  if (!r.ok) console.error('[ESTUDIO-DRIVE] falha ao conectar (troca do code)')
  return fim(r.ok ? 'ok' : 'erro')
}
