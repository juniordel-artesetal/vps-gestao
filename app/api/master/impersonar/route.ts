// app/api/master/impersonar/route.ts
// "Acessar como": o Master forja, DE FORMA SEGURA E AUDITADA, uma sessão NextAuth
// para um usuário-alvo — sem nunca usar/expor a senha dele.
// Segurança: só inicia com master_token httpOnly válido (não legível pelo client);
// a sessão é assinada server-side com o mesmo NEXTAUTH_SECRET; marca impersonatedBy;
// toda ação é registrada em ImpersonationLog.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Nome do cookie de sessão do NextAuth (v4): prefixo __Secure- quando https.
export function sessionCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
}

export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return NextResponse.json({ error: 'NEXTAUTH_SECRET ausente' }, { status: 500 })

  const { workspaceId, userId } = await req.json()
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 })

  // Usuário-alvo: o informado, senão o ADMIN do workspace, senão o mais antigo.
  const [alvo] = await prisma.$queryRaw`
    SELECT u."id", u."nome", u."email", u."role", u."workspaceId",
           w."nome" AS "workspaceNome", w."ativo" AS "workspaceAtivo"
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE u."workspaceId" = ${workspaceId}
      AND (${userId ?? null}::text IS NULL OR u."id" = ${userId ?? null})
    ORDER BY (u."role" = 'ADMIN') DESC, u."createdAt" ASC
    LIMIT 1
  ` as any[]
  if (!alvo) return NextResponse.json({ error: 'Usuário-alvo não encontrado' }, { status: 404 })

  const masterNome = process.env.MASTER_USER || 'Master'
  const ip = req.headers.get('x-forwarded-for') || 'unknown'

  // Sessão forjada — mesmos campos que o login normal produz + marcador.
  const token = {
    sub: alvo.id, id: alvo.id, name: alvo.nome, email: alvo.email,
    role: alvo.role, workspaceId: alvo.workspaceId, workspaceNome: alvo.workspaceNome,
    workspaceAtivo: alvo.workspaceAtivo, primeiroLogin: false,
    impersonatedBy: masterNome,
  }
  const maxAge = 60 * 60 * 8 // 8h
  const encoded = await encode({ token, secret, maxAge })

  // Auditoria
  try {
    await prisma.$executeRaw`
      INSERT INTO "ImpersonationLog" ("id","masterId","masterNome","workspaceId","workspaceNome","userId","userNome","acao","ip","createdAt")
      VALUES (${novoId()}, ${masterNome}, ${masterNome}, ${alvo.workspaceId}, ${alvo.workspaceNome}, ${alvo.id}, ${alvo.nome}, 'iniciou', ${String(ip)}, NOW())
    `
  } catch (e) { console.error('[impersonar] audit:', e) }

  const res = NextResponse.json({ ok: true, redirect: '/modulos', workspaceNome: alvo.workspaceNome, userNome: alvo.nome })
  res.cookies.set(sessionCookieName(), encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
  return res
}
