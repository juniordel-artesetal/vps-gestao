import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { normNome } from '@/lib/normNome'
import { indexarVariacoes } from '@/lib/matchVariacao'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Itens (produtos) de um pedido, normalizados. Se não houver produtos[], usa o texto do produto.
type ItemPed = { nome: string; quantidade: number; valorUnitario: number | null; variacaoId: string | null }
function itensDoPedido(o: any): ItemPed[] {
  let extras: any = null
  try { extras = o.camposExtras ? JSON.parse(o.camposExtras) : null } catch { extras = null }
  if (extras && Array.isArray(extras.produtos) && extras.produtos.length > 0) {
    return extras.produtos.filter((p: any) => p && p.nome).map((p: any) => ({
      nome: String(p.nome), quantidade: Number(p.quantidade) || 1,
      valorUnitario: p.valorUnitario != null ? Number(p.valorUnitario) : null,
      variacaoId: p.variacaoId || null,
    }))
  }
  if (o.produto) {
    const q = Number(o.quantidade) || 1
    return [{ nome: String(o.produto), quantidade: q, valorUnitario: o.valor != null ? Number(o.valor) / q : null, variacaoId: null }]
  }
  return []
}

// GET — nomes de produto DISTINTOS de pedidos não vinculados, com nº de pedidos e sugestão.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId

    const variacoesRaw = await prisma.$queryRaw`
      SELECT v."id", v."nome", p."nome" AS "produtoNome", v."isKit", v."qtdKit"
      FROM "PrecVariacao" v INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
    ` as any[]
    const indice = indexarVariacoes(variacoesRaw)
    const labelDe = (id: string) => { const v = variacoesRaw.find(x => x.id === id); return v ? (v.nome ? `${v.produtoNome} — ${v.nome}` : v.produtoNome) : null }

    const deParaRows = await prisma.$queryRaw`SELECT "chaveExterna","variacaoId" FROM "MarketplaceProdutoVinculo" WHERE "workspaceId" = ${workspaceId}` as any[]
    const deParaMap = new Map<string, string>()
    for (const r of deParaRows) deParaMap.set(String(r.chaveExterna), String(r.variacaoId))

    const pedidos = await prisma.$queryRaw`
      SELECT o."id", o."produto", o."quantidade"::int AS "quantidade", o."valor"::float AS "valor", o."camposExtras"
      FROM "Order" o WHERE o."workspaceId" = ${workspaceId} AND o."status" <> 'CANCELADO'
    ` as any[]

    // Agrupa por nome distinto, contando pedidos com item NÃO vinculado
    const porNome = new Map<string, Set<string>>()
    for (const o of pedidos) {
      for (const it of itensDoPedido(o)) {
        if (it.variacaoId) continue
        const key = it.nome
        if (!porNome.has(key)) porNome.set(key, new Set())
        porNome.get(key)!.add(o.id)
      }
    }

    const itens = Array.from(porNome.entries()).map(([nome, ids]) => {
      const viaDePara = deParaMap.get(normNome(nome))
      let sugestao: { variacaoId: string; label: string | null } | null = null
      let status: 'match' | 'ambiguo' | 'nenhum' = 'nenhum'
      if (viaDePara) { sugestao = { variacaoId: viaDePara, label: labelDe(viaDePara) }; status = 'match' }
      else {
        const r = indice.resolver(nome)
        if (r.status === 'match') { sugestao = { variacaoId: r.variacaoId, label: labelDe(r.variacaoId) }; status = 'match' }
        else status = r.status === 'ambiguo' ? 'ambiguo' : 'nenhum'
      }
      return { nome, pedidos: ids.size, sugestao, status }
    }).sort((a, b) => b.pedidos - a.pedidos)

    // Todas as variações (para o dropdown "escolher outra")
    const variacoes = variacoesRaw.map(v => ({ id: v.id, label: v.nome ? `${v.produtoNome} — ${v.nome}` : v.produtoNome }))
    return NextResponse.json(serialize({ itens, variacoes, totalNomes: itens.length }))
  } catch (e) {
    console.error('[vincular-pedidos GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST { mapeamentos: [{nome, variacaoId}], recalcularPecas?: boolean }
// Grava variacaoId em TODOS os pedidos com aquele nome (item ainda não vinculado) + de-para.
// recalcularPecas (OFF por padrão): ajusta peças pelo kit e RE-DERIVA valorUnitario para o
// total da linha NÃO mudar (valor real intocado). Idempotente. Order.valor nunca é tocado.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { mapeamentos, recalcularPecas } = await req.json()
    if (!Array.isArray(mapeamentos) || mapeamentos.length === 0) return NextResponse.json({ error: 'Nada a aplicar' }, { status: 400 })

    // valida variacaoId do workspace + carrega qtdKit/isKit
    const infoById = new Map<string, { isKit: boolean; qtdKit: number }>()
    const vars = await prisma.$queryRaw`
      SELECT v."id", v."isKit", v."qtdKit" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE p."workspaceId" = ${workspaceId}` as any[]
    for (const v of vars) infoById.set(String(v.id), { isKit: !!v.isKit, qtdKit: Math.max(Number(v.qtdKit) || 1, 1) })

    // nome → variacaoId (só os válidos)
    const mapa = new Map<string, string>()
    for (const m of mapeamentos) {
      const nome = String(m?.nome || ''); const vid = String(m?.variacaoId || '')
      if (nome && vid && infoById.has(vid)) mapa.set(nome, vid)
    }
    if (mapa.size === 0) return NextResponse.json({ error: 'Nenhum mapeamento válido' }, { status: 400 })

    const pedidos = await prisma.$queryRaw`
      SELECT o."id", o."produto", o."quantidade"::int AS "quantidade", o."valor"::float AS "valor", o."camposExtras"
      FROM "Order" o WHERE o."workspaceId" = ${workspaceId} AND o."status" <> 'CANCELADO'
    ` as any[]

    let pedidosAtualizados = 0
    const somaAntes = pedidos.reduce((s, o) => s + (Number(o.valor) || 0), 0)

    await prisma.$transaction(async (tx) => {
      for (const o of pedidos) {
        let extras: any = null
        try { extras = o.camposExtras ? JSON.parse(o.camposExtras) : null } catch { extras = null }
        let produtos: any[] = (extras && Array.isArray(extras.produtos)) ? extras.produtos : null as any
        // Sem produtos[]: materializa a partir do texto (só se casar com algum mapeamento)
        if (!produtos) {
          if (!o.produto || !mapa.has(String(o.produto))) continue
          const q = Number(o.quantidade) || 1
          produtos = [{ nome: String(o.produto), quantidade: q, valorUnitario: o.valor != null ? Number(o.valor) / q : null, variacaoId: null }]
          extras = extras && typeof extras === 'object' ? extras : {}
        }

        let mudou = false
        let novaQtdOrder = 0
        for (const it of produtos) {
          const vid = it.variacaoId ? null : mapa.get(String(it.nome))
          if (vid) {
            it.variacaoId = vid
            mudou = true
            if (recalcularPecas) {
              const info = infoById.get(vid)!
              const qAtual = Number(it.quantidade) || 1
              const vu = it.valorUnitario != null ? Number(it.valorUnitario) : null
              const totalLinha = vu != null ? vu * qAtual : null
              // unidades: se qtdKit divide a qtd atual (já em peças) mantém; senão assume 1 unidade
              const unidades = (info.qtdKit > 0 && qAtual % info.qtdKit === 0 && qAtual / info.qtdKit >= 1) ? qAtual / info.qtdKit : 1
              const novasPecas = info.isKit && info.qtdKit > 1 ? info.qtdKit * unidades : qAtual
              it.quantidade = novasPecas
              if (totalLinha != null && novasPecas > 0) it.valorUnitario = totalLinha / novasPecas  // total da linha intocado
            }
          }
          novaQtdOrder += Number(it.quantidade) || 1
        }

        if (mudou) {
          extras.produtos = produtos
          const extrasStr = JSON.stringify(extras)
          if (recalcularPecas) {
            await tx.$executeRaw`UPDATE "Order" SET "camposExtras" = ${extrasStr}, "quantidade" = ${novaQtdOrder}, "updatedAt" = NOW() WHERE "id" = ${o.id} AND "workspaceId" = ${workspaceId}`
          } else {
            await tx.$executeRaw`UPDATE "Order" SET "camposExtras" = ${extrasStr}, "updatedAt" = NOW() WHERE "id" = ${o.id} AND "workspaceId" = ${workspaceId}`
          }
          pedidosAtualizados++
        }
      }

      // Salva o de-para (canal 'shopee') p/ próximas importações auto-vincularem
      for (const [nome, vid] of mapa) {
        const chave = normNome(nome)
        if (!chave) continue
        await tx.$executeRaw`
          INSERT INTO "MarketplaceProdutoVinculo" ("id","workspaceId","canal","chaveExterna","variacaoId","createdAt")
          VALUES (${gerarId()}, ${workspaceId}, ${'shopee'}, ${chave}, ${vid}, NOW())
          ON CONFLICT ("workspaceId","canal","chaveExterna") DO UPDATE SET "variacaoId" = EXCLUDED."variacaoId"`
      }
    })

    // Porteiro: Order.valor nunca foi tocado
    const [{ soma }] = await prisma.$queryRaw`SELECT COALESCE(SUM("valor"),0)::float AS soma FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADO'` as any[]
    return NextResponse.json(serialize({
      ok: true, pedidosAtualizados,
      porteiro: { antes: Number(somaAntes.toFixed(2)), depois: Number(Number(soma).toFixed(2)), ok: Math.abs(somaAntes - Number(soma)) < 0.01 },
    }))
  } catch (e) {
    console.error('[vincular-pedidos POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
