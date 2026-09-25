// Master — retorno do OAuth do Drive do acervo. Nunca loga code/token.
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { conectarAcervo, stateValido } from '@/lib/estudio/acervoDrive'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const volta = new URL('/master/estudio-acervo', req.url)
  if (!(await ehMaster(req))) return NextResponse.redirect(new URL('/master/login', req.url))
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  if (!code || !stateValido(u.searchParams.get('state'), req.cookies.get('acervo_nonce')?.value)) { volta.searchParams.set('drive', 'erro'); return NextResponse.redirect(volta) }
  const ok = await conectarAcervo(code, u.origin).catch(() => false)
  volta.searchParams.set('drive', ok ? 'conectado' : 'erro')
  const res = NextResponse.redirect(volta)
  res.cookies.delete('acervo_nonce')
  return res
}
