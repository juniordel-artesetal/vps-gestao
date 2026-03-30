import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  const userOk = user === process.env.MASTER_USER
  const passOk = pass === process.env.MASTER_PASS

  if (!userOk || !passOk) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // path '/' garante que o cookie é enviado tanto para /master quanto para /api/master
  res.cookies.set('master_token', process.env.MASTER_SECRET_TOKEN!, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete({ name: 'master_token', path: '/' })
  return res
}
