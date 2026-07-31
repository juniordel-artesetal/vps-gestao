// Histórico de compras: lista de itens comprados (fornecedor, material, qtd, valor, data,
// status), evolução de preço por material, resumo por fornecedor/material, e comparação
// com o preço de MERCADO (índice crowd) — indicador "boa compra".
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureComprasSchema } from '@/lib/compras'
import { calcularIndice } from '@/lib/indicePrecos'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureComprasSchema()

  const url = new URL(req.url)
  const fFornecedor = url.searchParams.get('fornecedorId') || ''
  const fMaterial   = url.searchParams.get('materialId') || ''
  const de = url.searchParams.get('de') || ''
  const ate = url.searchParams.get('ate') || ''

  const todos = await prisma.$queryRaw`
    SELECT ci."id", ci."compraId", ci."materialId", ci."nome", ci."qtdPacotes", ci."qtdPacote",
           ci."precoPacote", ci."precoUnidade", ci."subtotal", ci."custoAtualizado",
           fc."data", fc."nf", fc."status" AS "compraStatus", fc."fornecedorId", f."nome" AS "fornecedorNome"
    FROM "CompraItem" ci
    JOIN "FornecedorCompra" fc ON fc."id" = ci."compraId"
    LEFT JOIN "Fornecedor" f ON f."id" = fc."fornecedorId"
    WHERE ci."workspaceId" = ${workspaceId}
    ORDER BY fc."data" DESC, ci."createdAt" DESC
  ` as any[]

  const dentroPeriodo = (d: any) => {
    const dia = d ? new Date(d).toISOString().slice(0, 10) : ''
    if (de && dia < de) return false
    if (ate && dia > ate) return false
    return true
  }
  const itens = todos.filter(r =>
    (!fFornecedor || r.fornecedorId === fFornecedor) &&
    (!fMaterial || r.materialId === fMaterial) &&
    dentroPeriodo(r.data),
  )

  // Contas a pagar geradas por cada compra (referencia = compraId).
  const compraIds = [...new Set(itens.map(i => i.compraId))]
  let contasPorCompra: Record<string, { total: number; pago: number; pendente: number }> = {}
  if (compraIds.length) {
    const lancs = await prisma.$queryRaw`
      SELECT "referencia", "status", COALESCE(SUM("valor"),0)::float AS total, COUNT(*)::int AS n
      FROM "FinLancamento"
      WHERE "workspaceId" = ${workspaceId} AND "referencia" = ANY(${compraIds}::text[])
      GROUP BY "referencia", "status"
    ` as any[]
    for (const l of lancs) {
      const c = contasPorCompra[l.referencia] || { total: 0, pago: 0, pendente: 0 }
      c.total += Number(l.total)
      if (l.status === 'PAGO') c.pago += Number(l.total); else c.pendente += Number(l.total)
      contasPorCompra[l.referencia] = c
    }
  }

  // Evolução de preço por material (todas as compras, ordenado por data).
  const evolucao: Record<string, { data: string; precoUnidade: number; nome: string }[]> = {}
  for (const r of [...todos].reverse()) {
    if (!r.materialId) continue
    ;(evolucao[r.materialId] ||= []).push({ data: r.data ? new Date(r.data).toISOString().slice(0, 10) : '', precoUnidade: Number(r.precoUnidade) || 0, nome: r.nome })
  }

  // Resumo (sobre o filtro aplicado).
  const porFornecedor = new Map<string, number>()
  const porMaterial = new Map<string, number>()
  let total = 0
  for (const r of itens) {
    const sub = Number(r.subtotal) || 0
    total += sub
    porFornecedor.set(r.fornecedorNome || '—', (porFornecedor.get(r.fornecedorNome || '—') || 0) + sub)
    porMaterial.set(r.nome, (porMaterial.get(r.nome) || 0) + sub)
  }
  const topN = (m: Map<string, number>) => [...m.entries()].map(([nome, v]) => ({ nome, total: v })).sort((a, b) => b.total - a.total).slice(0, 8)

  // Preço de MERCADO por material (crowd) — para o indicador "boa compra". Cap de chamadas.
  const nomesDistintos = [...new Set(itens.map(i => i.nome).filter(Boolean))].slice(0, 25)
  const mercado: Record<string, { medio: number; confiabilidade: string } | null> = {}
  await Promise.all(nomesDistintos.map(async nome => {
    try {
      const idx: any = await calcularIndice(String(nome))
      mercado[normNome(nome)] = idx?.suficiente ? { medio: idx.medio, confiabilidade: idx.confiabilidade } : null
    } catch { mercado[normNome(nome)] = null }
  }))

  return NextResponse.json(serialize({
    itens,
    contasPorCompra,
    evolucao,
    mercado,
    resumo: { total, porFornecedor: topN(porFornecedor), porMaterial: topN(porMaterial), compras: compraIds.length, itens: itens.length },
  }))
}
