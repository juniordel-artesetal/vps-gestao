// app/api/master/impersonar/sair/route.ts
// Encerra a impersonation: registra 'saiu', apaga a sessão forjada e volta ao Master.
// Pode ser chamado pela sessão forjada (que carrega impersonatedBy no token) OU pelo
// Master (cookie master_token ainda presente). Sem qualquer deles, 401.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { sessionCookieName } from '../route'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  const token: any = secret ? await getToken({ req, secret }) : null
  const c = await cookies()
  const masterOk = c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
  const impersonando = !!token?.impersonatedBy

  if (!masterOk && !impersonando) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (impersonando) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    try {
      await prisma.$executeRaw`
        INSERT INTO "ImpersonationLog" ("id","masterId","masterNome","workspaceId","workspaceNome","userId","userNome","acao","ip","createdAt")
        VALUES (${novoId()}, ${token.impersonatedBy ?? null}, ${token.impersonatedBy ?? null}, ${token.workspaceId ?? ''}, ${token.workspaceNome ?? null}, ${token.id ?? null}, ${token.name ?? null}, 'saiu', ${String(ip)}, NOW())
      `
    } catch (e) { console.error('[impersonar/sair] audit:', e) }
  }

  const res = NextResponse.json({ ok: true, redirect: '/master' })
  // Apaga a sessão forjada (ambos os nomes possíveis, por segurança)
  for (const name of ['next-auth.session-token', '__Secure-next-auth.session-token', sessionCookieName()]) {
    res.cookies.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  }
  return res
}
