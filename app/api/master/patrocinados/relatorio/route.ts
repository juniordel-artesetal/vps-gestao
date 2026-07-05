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

// GET ?de=YYYY-MM-DD&ate=YYYY-MM-DD&id= — relatório simples de desempenho
// (impressões, cliques, CTR) por patrocinado, a partir dos eventos. SEM valores de gasto.
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const de = sp.get('de') || null
  const ate = sp.get('ate') || null
  const id = sp.get('id') || null

  // Agrega os eventos no período (inclusivo). Sem período => todos os eventos.
  const eventos = await prisma.$queryRaw`
    SELECT e."patrocinadoId" AS "id",
           COUNT(*) FILTER (WHERE e."tipo"='impressao')::int AS "impressoes",
           COUNT(*) FILTER (WHERE e."tipo"='clique')::int AS "cliques"
    FROM "PesquisaAnuncioEvento" e
    WHERE (${de}::date IS NULL OR e."createdAt" >= ${de}::date)
      AND (${ate}::date IS NULL OR e."createdAt" < (${ate}::date + 1))
      AND (${id}::text IS NULL OR e."patrocinadoId" = ${id})
    GROUP BY e."patrocinadoId"
  ` as { id: string; impressoes: number; cliques: number }[]
  const porId = new Map(eventos.map(e => [e.id, e]))

  const pats = await prisma.$queryRaw`
    SELECT "id","nome","anunciante","ativo","dataInicio","dataFim",
           "impressoes" AS "impressoesTotal","cliques" AS "cliquesTotal"
    FROM "PesquisaPatrocinado"
    WHERE (${id}::text IS NULL OR "id" = ${id})
    ORDER BY "ativo" DESC, "prioridade" DESC, "createdAt" DESC
  ` as any[]

  const linhas = pats.map((p: any) => {
    const ev = porId.get(p.id)
    const impressoes = ev?.impressoes ?? 0
    const cliques = ev?.cliques ?? 0
    const ctr = impressoes > 0 ? Math.round((cliques / impressoes) * 1000) / 10 : 0 // %
    return {
      id: p.id, nome: p.nome, anunciante: p.anunciante, ativo: p.ativo,
      dataInicio: p.dataInicio, dataFim: p.dataFim,
      impressoes, cliques, ctr,
      impressoesTotal: p.impressoesTotal, cliquesTotal: p.cliquesTotal,
    }
  })

  return NextResponse.json(serialize({ de, ate, linhas }))
}
