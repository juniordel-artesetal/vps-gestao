import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  const masterUser  = process.env.MASTER_USER  || 'junior'
  const masterPass  = process.env.MASTER_PASS  || ''
  const masterToken = process.env.MASTER_SECRET_TOKEN || ''

  if (user !== masterUser || pass !== masterPass) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, token: masterToken })

  // Cookie para autenticar rotas que usam cookie
  res.cookies.set('master_token', masterToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })

  return res
}
