import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { carregarCustosVariacao, carregarResolvedorVariacao } from '@/lib/margem'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// ─────────────────────────────────────────────────────────────
// Resultado das vendas — ESTIMADO pela precificação (NÃO é caixa).
// Por mês (últimos N), sobre pedidos não cancelados:
//   vendas         = Σ valor do pedido
//   custoMateriais = Σ custoMaterial da variação × qtd (itens vinculados)
//   taxas          = Σ precoVenda × (impostos% / 100) × qtd
//   outrosCustos   = Σ (mãoDeObra + embalagem + arte) × qtd
//   lucro          = vendas − taxas − custoMateriais − outrosCustos
// Itens sem vínculo NÃO entram no custo; a cobertura sinaliza isso.
// Este endpoint é leitura/estimativa — nunca cria/edita FinLancamento.
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const nMeses = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('meses') || '6'), 1), 12)

    // Janela: primeiro dia do mês (nMeses-1) atrás (UTC, coerente com createdAt)
    const agora = new Date()
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (nMeses - 1), 1))
    const inicioISO = inicio.toISOString()

    const [custos, resolver] = await Promise.all([
      carregarCustosVariacao(workspaceId),
      carregarResolvedorVariacao(workspaceId),
    ])

    // Pedidos não cancelados na janela (colunas explícitas — nunca SELECT *)
    const pedidos = await prisma.$queryRaw`
      SELECT o."id", COALESCE(o."valor", 0)::float AS "valor",
             o."produto", o."quantidade"::int AS "quantidade", o."camposExtras",
             o."createdAt"
      FROM "Order" o
      WHERE o."workspaceId" = ${workspaceId}
        AND o."status" <> 'CANCELADO'
        AND o."createdAt" >= ${inicioISO}::timestamptz
    ` as any[]

    // Semeia os N meses (mesmo vazios) para o gráfico
    type Mes = { ano: number; mes: number; vendas: number; taxas: number; custoMateriais: number; outrosCustos: number; lucro: number; itensVinculados: number; itensTotal: number }
    const mapaMes = new Map<string, Mes>()
    for (let i = 0; i < nMeses; i++) {
      const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1))
      const ano = d.getUTCFullYear(), mes = d.getUTCMonth() + 1
      mapaMes.set(`${ano}-${mes}`, { ano, mes, vendas: 0, taxas: 0, custoMateriais: 0, outrosCustos: 0, lucro: 0, itensVinculados: 0, itensTotal: 0 })
    }

    let itensVincTotal = 0, itensTotalGeral = 0

    for (const p of pedidos) {
      const d = new Date(p.createdAt)
      const chave = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
      const m = mapaMes.get(chave)
      if (!m) continue // fora da janela (defensivo)

      m.vendas += Number(p.valor) || 0

      // Itens: preferir camposExtras.produtos[]; fallback = produto/quantidade do pedido
      let itens: { nome: string; quantidade: number; variacaoId: string | null }[] = []
      try {
        const extras = typeof p.camposExtras === 'string' ? JSON.parse(p.camposExtras) : p.camposExtras
        if (extras && Array.isArray(extras.produtos) && extras.produtos.length > 0) {
          itens = extras.produtos.filter((x: any) => x && x.nome).map((x: any) => ({
            nome: String(x.nome), quantidade: Number(x.quantidade) || 1, variacaoId: x.variacaoId || null,
          }))
        }
      } catch { /* camposExtras inválido → cai no fallback */ }
      if (itens.length === 0 && p.produto) {
        itens = [{ nome: String(p.produto), quantidade: Number(p.quantidade) || 1, variacaoId: null }]
      }

      for (const it of itens) {
        m.itensTotal++; itensTotalGeral++
        const variacaoId = it.variacaoId || resolver(null, it.nome)
        const c = variacaoId ? custos.get(variacaoId) : undefined
        if (!c) continue // sem vínculo → não inventa custo
        const qtd = it.quantidade || 1
        m.custoMateriais += c.custoMaterial * qtd
        m.outrosCustos   += (c.custoMaoObra + c.custoEmbalagem + c.custoArte) * qtd
        m.taxas          += c.precoVenda * (c.impostosPct / 100) * qtd
        m.itensVinculados++; itensVincTotal++
      }
    }

    const meses = Array.from(mapaMes.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(m => ({ ...m, lucro: m.vendas - m.taxas - m.custoMateriais - m.outrosCustos }))

    const totais = meses.reduce((acc, m) => ({
      vendas: acc.vendas + m.vendas, taxas: acc.taxas + m.taxas,
      custoMateriais: acc.custoMateriais + m.custoMateriais, outrosCustos: acc.outrosCustos + m.outrosCustos,
      lucro: acc.lucro + m.lucro,
    }), { vendas: 0, taxas: 0, custoMateriais: 0, outrosCustos: 0, lucro: 0 })

    return NextResponse.json(serialize({
      estimado: true,
      meses,
      totais,
      cobertura: itensTotalGeral > 0 ? itensVincTotal / itensTotalGeral : 0,
      itensVinculados: itensVincTotal,
      itensTotal: itensTotalGeral,
    }))
  } catch (error) {
    console.error('[GET /api/dashboard/resultado]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
