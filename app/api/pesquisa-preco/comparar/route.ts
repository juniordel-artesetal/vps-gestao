import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularIndice } from '@/lib/indicePrecos'
import { normNome } from '@/lib/normNome'

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

// GET — "Seu preço vs mercado": compara os materiais DO PRÓPRIO workspace com o
// índice agregado. Usa só o dado da artesã + agregados do mercado (privacidade).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const [ws] = await prisma.$queryRaw`SELECT "moduloAssistenteCompras" FROM "Workspace" WHERE "id"=${session.user.workspaceId} LIMIT 1` as any[]
  if (!ws?.moduloAssistenteCompras) return NextResponse.json({ error: 'Módulo não ativado' }, { status: 403 })

  const meus = await prisma.$queryRaw`
    SELECT "nome", "precoUnidade"::float AS "preco", "unidade"
    FROM "PrecMaterial"
    WHERE "workspaceId"=${session.user.workspaceId} AND "ativo"=true AND COALESCE("precoUnidade",0) > 0
  ` as { nome: string; preco: number; unidade: string | null }[]

  // Agrupa por normNome (preço médio da artesã por material) e pega os mais caros
  const porNorm = new Map<string, { nome: string; precos: number[]; unidade: string | null }>()
  for (const m of meus) {
    const qn = normNome(m.nome)
    if (!qn) continue
    const g = porNorm.get(qn) || { nome: m.nome, precos: [], unidade: m.unidade }
    g.precos.push(Number(m.preco)); porNorm.set(qn, g)
  }
  const candidatos = [...porNorm.entries()]
    .map(([qn, g]) => ({ qn, nome: g.nome, unidade: g.unidade, seuPreco: g.precos.reduce((a, b) => a + b, 0) / g.precos.length }))
    .sort((a, b) => b.seuPreco - a.seuPreco)
    .slice(0, 40) // limita o custo (materiais mais caros = maior potencial)

  const itens: any[] = []
  for (const c of candidatos) {
    const idx = await calcularIndice(c.qn)
    if (!idx.suficiente) continue
    const diffPct = idx.medio > 0 ? Math.round(((c.seuPreco - idx.medio) / idx.medio) * 100) : 0
    itens.push({
      nome: c.nome,
      unidade: c.unidade,
      seuPreco: c.seuPreco,
      mercadoMedio: idx.medio,
      mercadoMenor: idx.menor,
      diffPct,
      economiaUnidade: Math.max(0, c.seuPreco - idx.medio),
      nFontes: idx.nFontes,
    })
  }
  const acima = itens.filter(i => i.diffPct > 5).sort((a, b) => b.economiaUnidade - a.economiaUnidade)
  const abaixo = itens.filter(i => i.diffPct < -5)

  return NextResponse.json(serialize({
    comparados: itens.length,
    acima,   // onde você paga acima do mercado (economizar)
    abaixo,  // onde você já compra bem
  }))
}
