import { NextRequest, NextResponse } from 'next/server'
import { verificarTotp } from '@/lib/doisFatores'

export async function POST(req: NextRequest) {
  const { user, pass, codigo } = await req.json()

  const masterUser  = process.env.MASTER_USER  || 'junior'
  const masterPass  = process.env.MASTER_PASS  || ''
  const masterToken = process.env.MASTER_SECRET_TOKEN || ''

  if (user !== masterUser || pass !== masterPass) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  // 2FA do Master — OPCIONAL e gated por env. Só exige o código quando
  // MASTER_2FA_SECRET (base32 do app autenticador) está definido. Sem a env, o
  // comportamento é idêntico ao de hoje (sem risco de se trancar fora).
  const master2fa = process.env.MASTER_2FA_SECRET || ''
  if (master2fa) {
    if (!codigo) {
      return NextResponse.json({ error: 'Informe o código do app autenticador.', need2fa: true }, { status: 401 })
    }
    if (!verificarTotp(master2fa, String(codigo))) {
      return NextResponse.json({ error: 'Código de verificação incorreto.', need2fa: true }, { status: 401 })
    }
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
