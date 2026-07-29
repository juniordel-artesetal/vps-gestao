// Custos fixos & rateio (2º modelo de precificação, opcional). GET traz a config + uma
// SUGESTÃO automática vinda do Financeiro/DRE (despesas fixas, faturamento e nº de peças
// do mês) pra ela não redigitar. PUT salva. POST 'simular' compara os métodos antes de salvar.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { getCustosFixos, salvarCustosFixos, ratearCustoFixo, METODOS, type CustosFixosConfig } from '@/lib/custosFixos'

export const dynamic = 'force-dynamic'

async function ws(): Promise<string | null> {
  const s = await getServerSession(authOptions)
  return s?.user?.workspaceId ?? null
}

// Sugestão vinda do Financeiro do mês atual: despesas fixas (categorias fora do CMV),
// faturamento (receitas) e nº de peças/pedidos. Espelha a lógica do DRE.
async function sugestaoDRE(workspaceId: string) {
  const agora = new Date(); const mes = agora.getMonth() + 1, ano = agora.getFullYear()
  const cats = await prisma.$queryRaw`
    SELECT fc."nome", COALESCE(SUM(fl."valor"),0)::float AS "total"
    FROM "FinLancamento" fl JOIN "FinCategoria" fc ON fc."id" = fl."categoriaId"
    WHERE fl."workspaceId" = ${workspaceId} AND fl."tipo" = 'DESPESA'
      AND EXTRACT(MONTH FROM fl."data") = ${mes} AND EXTRACT(YEAR FROM fl."data") = ${ano}
    GROUP BY fc."id", fc."nome"
  ` as { nome: string; total: number }[]
  const CMV = ['material', 'mercadori', 'insumo', 'matéria', 'produto', 'cmv', 'embalagem', 'custo prod']
  let despesasFixas = 0
  for (const c of cats) { if (!CMV.some(p => (c.nome || '').toLowerCase().includes(p))) despesasFixas += Number(c.total) || 0 }
  const [rec] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("valor"),0)::float AS "receita" FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA'
      AND EXTRACT(MONTH FROM "data") = ${mes} AND EXTRACT(YEAR FROM "data") = ${ano}
  ` as { receita: number }[]
  const [ped] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "qtd" FROM "Order"
    WHERE "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADO'
      AND EXTRACT(MONTH FROM "createdAt") = ${mes} AND EXTRACT(YEAR FROM "createdAt") = ${ano}
  ` as { qtd: number }[]
  return { despesasFixas: Math.round(despesasFixas * 100) / 100, faturamentoMes: Math.round((rec?.receita || 0) * 100) / 100, pedidosMes: ped?.qtd || 0 }
}

export async function GET() {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const [config, sugestao] = await Promise.all([getCustosFixos(workspaceId), sugestaoDRE(workspaceId)])
  return NextResponse.json(serialize({ config, sugestao, metodos: METODOS }))
}

export async function PUT(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  await salvarCustosFixos(workspaceId, {
    ativo: b.ativo == null ? undefined : !!b.ativo,
    metodo: b.metodo, custoFixoMensal: b.custoFixoMensal, itens: b.itens,
    unidadesMes: b.unidadesMes, horasMes: b.horasMes, faturamentoMes: b.faturamentoMes,
    valorManual: b.valorManual, percentualPerda: b.percentualPerda,
  })
  return NextResponse.json(serialize({ ok: true, config: await getCustosFixos(workspaceId) }))
}

// POST { acao:'simular', config, preco, custoVariavel, horasProduto } → compara com/sem rateio.
export async function POST(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (b.acao !== 'simular') return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  const cfg: CustosFixosConfig = { ...(await getCustosFixos(workspaceId)), ...(b.config || {}), ativo: true }
  const preco = Math.max(0, Number(b.preco) || 0)
  const custoVariavel = Math.max(0, Number(b.custoVariavel) || 0)
  const horasProduto = Math.max(0, Number(b.horasProduto) || 0)
  const { rateioRS, rateioPct } = ratearCustoFixo(cfg, { horasProduto })
  const custoFixoRateado = Math.round((rateioRS + preco * rateioPct) * 100) / 100
  const lucroContribuicao = Math.round((preco - custoVariavel) * 100) / 100
  const lucroReal = Math.round((lucroContribuicao - custoFixoRateado) * 100) / 100
  return NextResponse.json(serialize({
    custoFixoRateado, rateioRS, rateioPct: Math.round(rateioPct * 10000) / 100,
    lucroContribuicao, lucroReal,
    margemContribuicao: preco > 0 ? Math.round((lucroContribuicao / preco) * 1000) / 10 : null,
    margemReal: preco > 0 ? Math.round((lucroReal / preco) * 1000) / 10 : null,
  }))
}
