import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ondeRealizado, valorRealizado, somaAberto } from '@/lib/finRealizado'

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

  // O DRE somava SUM("valor") SEM filtro de status: contava o previsto como realizado e pegava o
  // valor CHEIO de um PARCIAL. Era o único lugar do módulo que fazia isso — por isso o "Resultado
  // do Mês" não fechava com a Visão Geral nem com o Caixa. Agora usa a regra única (realizado),
  // e o previsto continua visível, só que separado (campos *Prevista/*Previstas).
  const [recRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(${valorRealizado()}), 0) AS receita
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'RECEITA' AND ${ondeRealizado()}
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const [despRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(${valorRealizado()}), 0) AS despesas
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'DESPESA' AND ${ondeRealizado()}
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  // Previsto do mês (a receber / a pagar) — não entra no resultado, mas aparece na tela.
  const [prevRow] = await prisma.$queryRaw`
    SELECT ${somaAberto('RECEITA')} AS "receitaPrevista",
           ${somaAberto('DESPESA')} AS "despesasPrevistas"
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const catRows = await prisma.$queryRaw`
    SELECT fc.nome, COALESCE(SUM(${valorRealizado('fl')}), 0) AS total
    FROM "FinLancamento" fl
    JOIN "FinCategoria" fc ON fc.id = fl."categoriaId"
    WHERE fl."workspaceId" = ${workspaceId}
      AND fl.tipo = 'DESPESA' AND ${ondeRealizado('fl')}
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
           COALESCE(SUM(${valorRealizado('fl')}), 0) AS "total"
    FROM "FinLancamento" fl
    JOIN "FinCategoria" fc ON fc."id" = fl."categoriaId"
    LEFT JOIN "FinCategoria" pc ON pc."id" = fc."parentId"
    WHERE fl."workspaceId" = ${workspaceId}
      AND ${ondeRealizado('fl')}
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
    receita:        recRow?.receita   || 0,   // realizado (entrou de fato)
    despesasTotais: despRow?.despesas || 0,   // realizado (saiu de fato)
    // Previsto do mês — mostrado à parte, fora do resultado.
    receitaPrevista:   prevRow?.receitaPrevista   || 0,
    despesasPrevistas: prevRow?.despesasPrevistas || 0,
    cmv,
    despesasFixas,
    qtdPedidos:     pedRow?.qtd       || 0,
    porConta,   // [{ contaId, conta, tipo, grupoDRE, total, subcontas:[{nome,total}] }]
  }))
}
