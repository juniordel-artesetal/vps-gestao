// Master — gera um LINK de reativação/assinatura PRÉ-VINCULADO ao workspace de UMA cliente.
//
// O link abre a MESMA tela do SOA (/assinatura) que mostra Mensal/Anual + Cartão +
// parcelado 12x, já IDENTIFICADA pelo token assinado (?e=&t=) — sem a artesã logar.
// Quando ela paga, a assinatura nasce VINCULADA ao workspace EXISTENTE (nunca cria conta).
//
// Segurança: guarda master; token é HMAC do e-mail (mesma infra do /migrar); NÃO cria
// cobrança aqui (só devolve o link — a artesã escolhe o plano e paga na página do Asaas);
// Prisma raw, sem SELECT *; escopo à cliente; LGPD (não loga CPF).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { tokenMigrar } from '@/lib/campanha/emails'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// Resolve o workspace por slug/id/e-mail e devolve o e-mail da ADMIN (que assina o token).
async function resolverCliente(o: { workspaceId?: string; slug?: string; email?: string }) {
  let workspaceId = (o.workspaceId || '').trim() || null
  if (!workspaceId && o.slug) {
    const [w] = await prisma.$queryRaw`SELECT "id" FROM "Workspace" WHERE "slug" = ${o.slug.trim()} LIMIT 1` as { id: string }[]
    workspaceId = w?.id ?? null
  }
  if (!workspaceId && o.email) {
    const [u] = await prisma.$queryRaw`
      SELECT "workspaceId" FROM "User" WHERE lower("email") = ${o.email.trim().toLowerCase()}
      ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
    ` as { workspaceId: string }[]
    workspaceId = u?.workspaceId ?? null
  }
  if (!workspaceId) return null

  const [ws] = await prisma.$queryRaw`
    SELECT "id", "nome", "slug", "assinaturaStatus"
    FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { id: string; nome: string; slug: string; assinaturaStatus: string }[]
  if (!ws) return null

  // E-mail que vai no token: o informado (se bater com um usuário do ws) OU a ADMIN.
  const [u] = await prisma.$queryRaw`
    SELECT lower("email") AS "email" FROM "User"
    WHERE "workspaceId" = ${workspaceId}
      AND (${o.email ?? null}::text IS NULL OR lower("email") = ${(o.email || '').toLowerCase()})
    ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
  ` as { email: string }[]
  if (!u?.email) return null

  return { ws, email: u.email }
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const cli = await resolverCliente({ workspaceId: b.workspaceId, slug: b.slug, email: b.email })
  if (!cli) return NextResponse.json({ error: 'Cliente não encontrada (confira slug/e-mail).' }, { status: 404 })

  const { ws, email } = cli
  const base = baseUrlDeHeaders(req.headers)
  const link = `${base}/assinatura?e=${encodeURIComponent(email)}&t=${tokenMigrar(email)}`

  // Idempotência (aviso, não bloqueio): se já está em dia, sinaliza pro Master.
  const jaAtiva = ['TRIAL', 'ATIVA'].includes(ws.assinaturaStatus)

  return NextResponse.json({
    ok: true,
    link,
    email,
    workspaceId: ws.id,
    workspaceNome: ws.nome,
    slug: ws.slug,
    assinaturaStatus: ws.assinaturaStatus,
    jaAtiva,
    aviso: jaAtiva ? 'Esta cliente já consta ATIVA/TRIAL — o link só é necessário se ela vai (re)assinar.' : null,
  })
}
