import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// POST — copia produto com todas as suas variações e materiais
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Buscar produto original
    const produtos = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (produtos.length === 0)
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const original = produtos[0]

    // Criar cópia do produto
    const novoProdutoId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const novoNome = `${original.nome} (cópia)`

    await prisma.$executeRaw`
      INSERT INTO "PrecProduto" ("id", "workspaceId", "nome", "sku", "categoria", "ativo", "createdAt", "updatedAt")
      VALUES (
        ${novoProdutoId},
        ${workspaceId},
        ${novoNome},
        ${original.sku ? original.sku + '-copia' : null},
        ${original.categoria ?? null},
        true,
        NOW(),
        NOW()
      )
    `

    // Buscar variações do produto original
    const variacoes = await prisma.$queryRaw`
      SELECT * FROM "PrecVariacao" WHERE "produtoId" = ${id}
    ` as any[]

    // Copiar cada variação
    for (const v of variacoes) {
      const novaVarId = Math.random().toString(36).slice(2) + Date.now().toString(36)

      await prisma.$executeRaw`
        INSERT INTO "PrecVariacao" (
          "id", "produtoId", "nome", "tipo", "isKit", "canal", "subOpcao", "qtdKit",
          "custoMaterial", "custoMaoObra", "custoEmbalagem", "custoArte", "custoTotal",
          "impostos", "precoVenda", "emPromo", "descontoPct", "precoPromocional",
          "metaVendas", "peso"
        ) VALUES (
          ${novaVarId}, ${novoProdutoId},
          ${v.nome ?? null}, ${v.tipo ?? 'UNITARIO'}, ${v.isKit ?? false},
          ${v.canal ?? 'shopee'}, ${v.subOpcao ?? 'classico'}, ${Number(v.qtdKit ?? 1)},
          ${Number(v.custoMaterial ?? 0)}, ${Number(v.custoMaoObra ?? 0)},
          ${Number(v.custoEmbalagem ?? 0)}, ${Number(v.custoArte ?? 0)},
          ${Number(v.custoTotal ?? 0)}, ${Number(v.impostos ?? 0)},
          ${Number(v.precoVenda ?? 0)}, ${v.emPromo ?? false},
          ${v.descontoPct ? Number(v.descontoPct) : null},
          ${v.precoPromocional ? Number(v.precoPromocional) : null},
          null,
          ${v.peso ? Number(v.peso) : null}
        )
      `

      // Copiar materiais da variação
      const materiais = await prisma.$queryRaw`
        SELECT * FROM "PrecMaterialItem" WHERE "variacaoId" = ${v.id}
      ` as any[]

      for (const m of materiais) {
        const novoMatId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem"
            ("id", "variacaoId", "materialId", "nomeMaterial", "qtdUsada", "custoUnit", "rendimento")
          VALUES (
            ${novoMatId}, ${novaVarId},
            ${m.materialId ?? null}, ${m.nomeMaterial ?? ''},
            ${Number(m.qtdUsada ?? 0)}, ${Number(m.custoUnit ?? 0)},
            ${Number(m.rendimento ?? 1)}
          )
        `
      }
    }

    return NextResponse.json(serialize({ ok: true, novoProdutoId, nome: novoNome }))
  } catch (err) {
    console.error('[POST copiar produto]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
