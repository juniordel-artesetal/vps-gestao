import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensureUsoLogSchema } from '@/lib/usoLog'
import bcrypt from 'bcryptjs'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista de assinantes/workspaces com busca, filtros, atividade e métricas.
// Params: q, status(ativo|inativo), plano, atividade(ativos|inativos)
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureUsoLogSchema() // garante a tabela p/ as subqueries de uso
  const sp = new URL(req.url).searchParams

  const cond: string[] = []
  const p: any[] = []
  const add = (sql: string, val: any) => { p.push(val); cond.push(sql.replace('?', `$${p.length}`)) }

  const status = sp.get('status')
  if (status === 'ativo') cond.push('t."ativo" = true')
  else if (status === 'inativo') cond.push('t."ativo" = false')
  const plano = sp.get('plano')
  if (plano) add('COALESCE(t."plano",\'FREE\') = ?', plano)
  const atividade = sp.get('atividade')
  if (atividade === 'ativos') cond.push('t."ultimoLogin" >= NOW() - INTERVAL \'7 days\'')
  else if (atividade === 'inativos') cond.push('(t."ultimoLogin" IS NULL OR t."ultimoLogin" < NOW() - INTERVAL \'30 days\')')
  const modulo = sp.get('modulo')
  if (modulo) add('t."moduloTop" = ?', modulo)
  const q = (sp.get('q') || '').trim()
  if (q) {
    p.push(`%${q}%`)
    const i = p.length
    cond.push(`(t."nome" ILIKE $${i} OR t."slug" ILIKE $${i} OR t."adminEmail" ILIKE $${i})`)
  }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : ''

  const ORDENS: Record<string, string> = {
    recentes:    't."createdAt" DESC',
    antigos:     't."createdAt" ASC',                              // contratação mais antiga primeiro
    ativos:      't."logins30d" DESC, t."ultimoLogin" DESC NULLS LAST',
    inativos:    't."ultimoLogin" ASC NULLS FIRST',                // sumidas primeiro (retenção)
    nome:        't."nome" ASC',
  }
  const orderBy = ORDENS[sp.get('ordenar') || 'recentes'] || ORDENS.recentes

  const inner = `
    SELECT w."id", w."nome", w."slug", w."plano", w."ativo", w."segmento", w."createdAt",
           (SELECT COUNT(*)::int FROM "User" u WHERE u."workspaceId" = w."id") AS "totalUsuarios",
           (SELECT u."email" FROM "User" u WHERE u."workspaceId" = w."id" ORDER BY (u."role"='ADMIN') DESC, u."createdAt" ASC LIMIT 1) AS "adminEmail",
           (SELECT MAX(lh."createdAt") FROM "LoginHistory" lh WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true) AS "ultimoLogin",
           (SELECT COUNT(*)::int FROM "LoginHistory" lh WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "logins30d",
           (SELECT COUNT(DISTINCT lh."createdAt"::date)::int FROM "LoginHistory" lh WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days') AS "diasAtivos30d",
           (SELECT ul."modulo" FROM "UsoLog" ul WHERE ul."workspaceId" = w."id" GROUP BY ul."modulo" ORDER BY SUM(ul."acessos") DESC, MAX(ul."dia") DESC LIMIT 1) AS "moduloTop"
    FROM "Workspace" w
  `

  const lista = await prisma.$queryRawUnsafe(
    `SELECT t.* FROM ( ${inner} ) t ${where} ORDER BY ${orderBy} LIMIT 500`,
    ...p
  ) as any[]

  // Métricas globais (independem dos filtros)
  const [m] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "ativo" = true)::int AS "ativos",
      COUNT(*) FILTER (WHERE "ativo" = false)::int AS "bloqueados",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days')::int AS "novos30d"
    FROM "Workspace"
  ` as any[]
  const [ina] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "inativos30d" FROM "Workspace" w
    WHERE NOT EXISTS (
      SELECT 1 FROM "LoginHistory" lh
      WHERE lh."workspaceId" = w."id" AND lh."sucesso" = true AND lh."createdAt" >= NOW() - INTERVAL '30 days'
    )
  ` as any[]

  return NextResponse.json(serialize({ lista, metricas: { ...m, inativos30d: ina?.inativos30d ?? 0 } }))
}

// POST — criar workspace manualmente (sem Hotmart)
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { nome, email, senha, plano } = body

    if (!nome || !email || !senha)
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })

    // Verificar se e-mail já existe
    const [existente] = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "email" = ${email.toLowerCase().trim()}
    ` as any[]
    if (existente)
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })

    const workspaceId = gerarId()
    const userId      = gerarId()
    const slug        = nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)
    const senhaHash   = await bcrypt.hash(senha, 10)
    const planoFinal  = plano || 'TRIAL'

    // Criar workspace
    await prisma.$executeRaw`
      INSERT INTO "Workspace" (
        "id","nome","slug","plano","ativo","createdAt","updatedAt"
      ) VALUES (
        ${workspaceId},${nome.trim()},${slug},${planoFinal},true,NOW(),NOW()
      )
    `

    // Criar usuário admin com primeiroLogin = true
    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt"
      ) VALUES (
        ${userId},${workspaceId},${nome.trim()},${email.toLowerCase().trim()},${senhaHash},'ADMIN',true,true,NOW()
      )
    `

    const [ws] = await prisma.$queryRaw`
      SELECT id, nome, slug, plano, ativo FROM "Workspace" WHERE "id" = ${workspaceId}
    ` as any[]

    return NextResponse.json(serialize({ ...ws, userId, email: email.toLowerCase().trim() }))
  } catch (error) {
    console.error('POST master/workspaces:', error)
    return NextResponse.json({ error: 'Erro interno ao criar workspace' }, { status: 500 })
  }
}
