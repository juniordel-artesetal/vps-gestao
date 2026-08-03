import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = (session.user as any).workspaceId
  const { searchParams } = new URL(req.url)
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))

  const [recRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0) AS receita
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'RECEITA'
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const [despRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0) AS despesas
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'DESPESA'
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const catRows = await prisma.$queryRaw`
    SELECT fc.nome, COALESCE(SUM(fl.valor), 0) AS total
    FROM "FinLancamento" fl
    JOIN "FinCategoria" fc ON fc.id = fl."categoriaId"
    WHERE fl."workspaceId" = ${workspaceId}
      AND fl.tipo = 'DESPESA'
      AND EXTRACT(MONTH FROM fl.data) = ${mes}
      AND EXTRACT(YEAR  FROM fl.data) = ${ano}
    GROUP BY fc.id, fc.nome
  ` as any[]

  const palavrasCMV = ['material', 'mercadori', 'insumo', 'matéria', 'produto', 'cmv', 'embalagem', 'custo prod']
  let cmv = 0
  let despesasFixas = 0
  for (const cat of catRows) {
    const nome  = (cat.nome || '').toLowerCase()
    const valor = parseFloat(String(cat.total)) || 0
    if (palavrasCMV.some(p => nome.includes(p))) cmv += valor
    else despesasFixas += valor
  }

  // ── Agrupamento por CONTA > SUBCONTA (plano de contas). Lançamentos antigos
  // (categoria flat / sem parent) aparecem como conta sozinha; nome livre fica de fora. ──
  const grupoRows = await prisma.$queryRaw`
    SELECT COALESCE(pc."id", fc."id")               AS "contaId",
           COALESCE(pc."nome", fc."nome")           AS "conta",
           COALESCE(fc."grupoDRE", pc."grupoDRE")   AS "grupoDRE",
           fc."tipo"                                AS "tipo",
           CASE WHEN fc."parentId" IS NULL THEN NULL ELSE fc."nome" END AS "subconta",
           COALESCE(SUM(fl.valor), 0)               AS "total"
    FROM "FinLancamento" fl
    JOIN "FinCategoria" fc ON fc."id" = fl."categoriaId"
    LEFT JOIN "FinCategoria" pc ON pc."id" = fc."parentId"
    WHERE fl."workspaceId" = ${workspaceId}
      AND EXTRACT(MONTH FROM fl.data) = ${mes}
      AND EXTRACT(YEAR  FROM fl.data) = ${ano}
    GROUP BY COALESCE(pc."id", fc."id"), COALESCE(pc."nome", fc."nome"),
             COALESCE(fc."grupoDRE", pc."grupoDRE"), fc."tipo", fc."parentId", fc."nome"
    ORDER BY "tipo", "conta"
  ` as any[]

  const mapaContas = new Map<string, any>()
  for (const g of grupoRows) {
    const total = parseFloat(String(g.total)) || 0
    let c = mapaContas.get(g.contaId)
    if (!c) { c = { contaId: g.contaId, conta: g.conta, tipo: g.tipo, grupoDRE: g.grupoDRE, total: 0, subcontas: [] as any[] }; mapaContas.set(g.contaId, c) }
    c.total += total
    if (g.subconta) c.subcontas.push({ nome: g.subconta, total })
  }
  const porConta = Array.from(mapaContas.values())
  // CMV pelo plano estruturado (grupoDRE) quando existir — mais confiável que a heurística.
  const cmvPlano = porConta.filter(c => c.tipo === 'DESPESA' && c.grupoDRE === 'cmv').reduce((s, c) => s + c.total, 0)
  if (cmvPlano > 0) { cmv = cmvPlano; despesasFixas = Math.max(0, (parseFloat(String(despRow?.despesas)) || 0) - cmv) }

  // Nº de Vendas = pedidos do período (não cancelados), pela DATA DA VENDA (dataEntrada, ou a
  // criação como fallback). NÃO exige "entregue" — a venda conta quando entra, igual à Receita
  // (que soma os lançamentos do período). Antes exigia status entregue e zerava com pedidos em produção.
  const [pedRow] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS qtd
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND status <> 'CANCELADO'
      AND EXTRACT(MONTH FROM COALESCE("dataEntrada", "createdAt")) = ${mes}
      AND EXTRACT(YEAR  FROM COALESCE("dataEntrada", "createdAt")) = ${ano}
  ` as any[]

  return NextResponse.json(serialize({
    receita:        recRow?.receita   || 0,
    despesasTotais: despRow?.despesas || 0,
    cmv,
    despesasFixas,
    qtdPedidos:     pedRow?.qtd       || 0,
    porConta,   // [{ contaId, conta, tipo, grupoDRE, total, subcontas:[{nome,total}] }]
  }))
}
