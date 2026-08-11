import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensureUsoLogSchema } from '@/lib/usoLog'
import bcrypt from 'bcryptjs'

// Serializa BigInt, Decimal e Date corretamente
function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// ── GET — detalhes completos do workspace + usuários + histórico de login
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  // Workspace completo
  const workspaces = await prisma.$queryRaw`
    SELECT * FROM "Workspace" WHERE "id" = ${id} LIMIT 1
  ` as unknown as any[]

  // Usuários
  const usuarios = await prisma.$queryRaw`
    SELECT id, nome, email, role, ativo, "primeiroLogin", "createdAt"
    FROM "User"
    WHERE "workspaceId" = ${id}
    ORDER BY "createdAt" ASC
  ` as unknown as any[]

  // Histórico de login (últimos 20)
  const loginHistory = await prisma.$queryRaw`
    SELECT lh.id, lh.email, lh."sucesso", lh.ip, lh."createdAt",
           u.nome AS "usuarioNome"
    FROM "LoginHistory" lh
    LEFT JOIN "User" u ON u.id = lh."userId"
    WHERE lh."workspaceId" = ${id}
    ORDER BY lh."createdAt" DESC
    LIMIT 20
  ` as unknown as any[]

  // ── USO & CONSUMO (agregado, sem dado pessoal) ────────────────────────────
  await ensureUsoLogSchema()

  // Resumo de atividade: último acesso (login OU ultimoAcesso do usuário), logins recentes, dias ativos.
  const [resumo] = await prisma.$queryRaw`
    SELECT
      GREATEST(
        (SELECT MAX(lh."createdAt") FROM "LoginHistory" lh WHERE lh."workspaceId" = ${id} AND lh."sucesso" = true),
        (SELECT MAX(u."ultimoAcesso") FROM "User" u WHERE u."workspaceId" = ${id})
      ) AS "ultimoAcesso",
      (SELECT COUNT(*)::int FROM "LoginHistory" lh WHERE lh."workspaceId" = ${id} AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '7 days')  AS "logins7d",
      (SELECT COUNT(*)::int FROM "LoginHistory" lh WHERE lh."workspaceId" = ${id} AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "logins30d",
      (SELECT COUNT(DISTINCT lh."createdAt"::date)::int FROM "LoginHistory" lh WHERE lh."workspaceId" = ${id} AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "diasAtivos30d",
      (SELECT COALESCE(SUM(ul."acessos"),0)::int FROM "UsoLog" ul WHERE ul."workspaceId" = ${id}) AS "totalUso"
  ` as any[]

  // Top módulos (all-time) — o que ela mais usa.
  const moduloTop = await prisma.$queryRaw`
    SELECT ul."modulo", SUM(ul."acessos")::int AS "acessos", COUNT(DISTINCT ul."dia")::int AS "dias"
    FROM "UsoLog" ul WHERE ul."workspaceId" = ${id}
    GROUP BY ul."modulo" ORDER BY "acessos" DESC LIMIT 6
  ` as any[]

  // Timeline das últimas 12 semanas: logins + uso agregado por semana (histórico de consumo).
  const loginsSemana = await prisma.$queryRaw`
    SELECT TO_CHAR(date_trunc('week', lh."createdAt"), 'YYYY-MM-DD') AS "semana", COUNT(*)::int AS "n"
    FROM "LoginHistory" lh
    WHERE lh."workspaceId" = ${id} AND lh."sucesso" = true AND lh."createdAt" >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
    GROUP BY 1
  ` as { semana: string; n: number }[]
  const usoSemana = await prisma.$queryRaw`
    SELECT TO_CHAR(date_trunc('week', ul."dia"), 'YYYY-MM-DD') AS "semana", SUM(ul."acessos")::int AS "n"
    FROM "UsoLog" ul
    WHERE ul."workspaceId" = ${id} AND ul."dia" >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
    GROUP BY 1
  ` as { semana: string; n: number }[]

  // Monta 12 buckets de semana (mais antiga → mais recente), preenchendo zeros.
  const mapLog = new Map(loginsSemana.map(r => [r.semana, r.n]))
  const mapUso = new Map(usoSemana.map(r => [r.semana, r.n]))
  const timeline: { semana: string; logins: number; uso: number }[] = []
  const base = new Date()
  const dow = (base.getUTCDay() + 6) % 7 // segunda = 0
  base.setUTCDate(base.getUTCDate() - dow)
  base.setUTCHours(0, 0, 0, 0)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const chave = d.toISOString().slice(0, 10)
    timeline.push({ semana: chave, logins: mapLog.get(chave) || 0, uso: mapUso.get(chave) || 0 })
  }

  return NextResponse.json(serialize({
    workspace: workspaces[0] ?? null,
    usuarios,
    loginHistory,
    uso: {
      ultimoAcesso: resumo?.ultimoAcesso ?? null,
      logins7d: resumo?.logins7d ?? 0,
      logins30d: resumo?.logins30d ?? 0,
      diasAtivos30d: resumo?.diasAtivos30d ?? 0,
      totalUso: resumo?.totalUso ?? 0,
      moduloTop,
      timeline,
    },
  }))
}

// ── PUT — editar workspace
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const { nome, plano, ativo } = await req.json()

  if (nome  !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "nome"  = ${nome}  WHERE "id" = ${id}`
  if (plano !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "plano" = ${plano} WHERE "id" = ${id}`
  if (ativo !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = ${ativo} WHERE "id" = ${id}`

  return NextResponse.json({ ok: true })
}

// ── DELETE — excluir workspace em cascata
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  await prisma.$executeRaw`DELETE FROM "LoginHistory"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "AiConversa"           WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "AiUsageLog"           WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "SuporteChamado"       WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Notificacao"          WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinMeta"              WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinLancamento"        WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinCategoria"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecConfigTributaria" WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecCombo"            WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecProduto"          WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecMaterial"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecEmbalagem"        WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "HotmartEvent"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "WorkItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "workspaceId" = ${id})`
  await prisma.$executeRaw`DELETE FROM "Order"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Setor"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "User"                 WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Workspace"            WHERE "id"          = ${id}`

  return NextResponse.json({ ok: true })
}

// ── PATCH — resetar senha de usuário específico
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { userId, novaSenha, role, ativo } = await req.json()

  if (novaSenha) {
    const hash = await bcrypt.hash(novaSenha, 10)
    await prisma.$executeRaw`UPDATE "User" SET "senha" = ${hash}, "primeiroLogin" = true WHERE "id" = ${userId}`
  }
  if (role  !== undefined) await prisma.$executeRaw`UPDATE "User" SET "role"  = ${role}  WHERE "id" = ${userId}`
  if (ativo !== undefined) await prisma.$executeRaw`UPDATE "User" SET "ativo" = ${ativo} WHERE "id" = ${userId}`

  return NextResponse.json({ ok: true })
}
