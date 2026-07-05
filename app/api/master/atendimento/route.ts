// app/api/master/atendimento/route.ts
// Caixa unificada (estilo Zendesk): UNION de SuporteChamado + SuporteFeedback de
// todos os workspaces, com filtros, busca e paginação. Só o MASTER acessa.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Subquery unificada: normaliza chamado e feedback numa mesma forma.
const UNIFICADO = `
  SELECT sc."id", 'CHAMADO' AS "tipo", NULL::text AS "subtipo", sc."protocolo",
         LEFT(COALESCE(sc."descricao", ''), 140) AS "assunto",
         sc."usuarioNome" AS "assinanteNome", sc."email", sc."workspaceId",
         sc."status", COALESCE(sc."prioridade", 'normal') AS "prioridade",
         sc."responsavelNome", sc."etiquetas", sc."whatsapp",
         sc."createdAt", sc."respondidoEm",
         COALESCE(sc."respondidoEm", sc."createdAt") AS "ultimaAtualizacao"
  FROM "SuporteChamado" sc
  UNION ALL
  SELECT sf."id", 'FEEDBACK' AS "tipo", sf."tipo" AS "subtipo", sf."protocolo",
         COALESCE(NULLIF(sf."titulo", ''), LEFT(COALESCE(sf."descricao", ''), 140)) AS "assunto",
         sf."usuarioNome" AS "assinanteNome", sf."email", sf."workspaceId",
         sf."status", COALESCE(sf."prioridade", 'normal') AS "prioridade",
         sf."responsavelNome", sf."etiquetas", sf."whatsapp",
         sf."createdAt", sf."respondidoEm",
         COALESCE(sf."respondidoEm", sf."createdAt") AS "ultimaAtualizacao"
  FROM "SuporteFeedback" sf
`

// GET — lista unificada com filtros e busca. Params:
// tipo, status, prioridade, responsavel, workspaceId, de, ate, q, page, limit
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const sp = new URL(req.url).searchParams

  const cond: string[] = []
  const p: any[] = []
  const add = (sql: string, val: any) => { p.push(val); cond.push(sql.replace('?', `$${p.length}`)) }

  const tipo = sp.get('tipo')
  if (tipo === 'CHAMADO' || tipo === 'FEEDBACK') add('t."tipo" = ?', tipo)
  const status = sp.get('status')
  if (status) add('t."status" = ?', status)
  const prioridade = sp.get('prioridade')
  if (prioridade) add('COALESCE(t."prioridade",\'normal\') = ?', prioridade)
  const responsavel = sp.get('responsavel')
  if (responsavel === '__sem__') cond.push('t."responsavelNome" IS NULL')
  else if (responsavel) add('t."responsavelNome" = ?', responsavel)
  const workspaceId = sp.get('workspaceId')
  if (workspaceId) add('t."workspaceId" = ?', workspaceId)
  const de = sp.get('de')
  if (de) add('t."createdAt" >= ?::date', de)
  const ate = sp.get('ate')
  if (ate) add('t."createdAt" < (?::date + 1)', ate)
  const q = (sp.get('q') || '').trim()
  if (q) {
    p.push(`%${q}%`)
    const i = p.length
    cond.push(`(t."protocolo" ILIKE $${i} OR t."email" ILIKE $${i} OR t."assinanteNome" ILIKE $${i} OR t."assunto" ILIKE $${i} OR w."nome" ILIKE $${i})`)
  }

  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : ''
  const base = `FROM ( ${UNIFICADO} ) t LEFT JOIN "Workspace" w ON w."id" = t."workspaceId" ${where}`

  const page = Math.max(1, Number(sp.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 30))
  const offset = (page - 1) * limit

  const [{ total }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total ${base}`, ...p) as any[]

  const rows = await prisma.$queryRawUnsafe(
    `SELECT t.*, w."nome" AS "workspaceNome"
     ${base}
     ORDER BY t."ultimaAtualizacao" DESC
     LIMIT ${limit} OFFSET ${offset}`,
    ...p
  ) as any[]

  return NextResponse.json(serialize({ itens: rows, total, page, limit, temMais: offset + rows.length < total }))
}
