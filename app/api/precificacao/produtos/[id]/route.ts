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

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — busca produto com todas as variações
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const produtos = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!produtos.length)
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const variacoes = await prisma.$queryRaw`
      SELECT * FROM "PrecVariacao"
      WHERE "produtoId" = ${id}
      ORDER BY "canal" ASC, "tipo" ASC
    ` as any[]

    // Para cada variação, busca seus materiais e kit items
    const variacoesCompletas = await Promise.all(
      variacoes.map(async (v: any) => {
        const materiais = await prisma.$queryRaw`
          SELECT * FROM "PrecMaterialItem" WHERE "variacaoId" = ${v.id}
        ` as any[]
        const kitItens = await prisma.$queryRaw`
          SELECT * FROM "PrecKitItem" WHERE "variacaoId" = ${v.id}
        ` as any[]
        return { ...v, materiais, kitItens }
      })
    )

    return NextResponse.json(serialize({ ...produtos[0], variacoes: variacoesCompletas }))
  } catch (e) {
    console.error('GET /api/precificacao/produtos/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — atualiza dados do produto (nome, sku, categoria, ativo)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { nome, sku, categoria, ativo } = body

    const exists = await prisma.$queryRaw`
      SELECT id FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length)
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    await prisma.$executeRaw`
      UPDATE "PrecProduto" SET
        "nome"      = COALESCE(${nome      ?? null}, "nome"),
        "sku"       = COALESCE(${sku       ?? null}, "sku"),
        "categoria" = COALESCE(${categoria ?? null}, "categoria"),
        "ativo"     = COALESCE(${ativo     != null ? Boolean(ativo) : null}, "ativo"),
        "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const updated = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json(serialize(updated[0]))
  } catch (e) {
    console.error('PUT /api/precificacao/produtos/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove produto com cascade completo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const exists = await prisma.$queryRaw`
      SELECT id FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length)
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    // Busca todas as variações do produto
    const variacoes = await prisma.$queryRaw`
      SELECT id FROM "PrecVariacao" WHERE "produtoId" = ${id}
    ` as any[]

    // Cascade: remove materiais e kit items de cada variação
    for (const v of variacoes) {
      await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId" = ${v.id}`
      await prisma.$executeRaw`DELETE FROM "PrecKitItem"      WHERE "variacaoId" = ${v.id}`
      await prisma.$executeRaw`DELETE FROM "PrecVariacaoHistorico" WHERE "variacaoId" = ${v.id}`
    }

    // Remove todas as variações
    await prisma.$executeRaw`DELETE FROM "PrecVariacao" WHERE "produtoId" = ${id}`

    // Remove o produto
    await prisma.$executeRaw`
      DELETE FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/precificacao/produtos/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — copia o produto com todas as variações
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Busca produto original
    const original = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!original.length)
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const prod = original[0]
    const novoProdutoId = gerarId()

    // Cria cópia do produto
    await prisma.$executeRaw`
      INSERT INTO "PrecProduto" ("id", "workspaceId", "nome", "sku", "categoria", "ativo", "createdAt", "updatedAt")
      VALUES (
        ${novoProdutoId},
        ${workspaceId},
        ${prod.nome + ' (cópia)'},
        ${prod.sku ? prod.sku + '-COPIA' : null},
        ${prod.categoria ?? null},
        true,
        NOW(),
        NOW()
      )
    `

    // Copia variações
    const variacoes = await prisma.$queryRaw`
      SELECT * FROM "PrecVariacao" WHERE "produtoId" = ${id}
    ` as any[]

    for (const v of variacoes) {
      const novaVarId = gerarId()

      await prisma.$executeRaw`
        INSERT INTO "PrecVariacao" (
          "id", "produtoId", "tipo", "isKit", "canal", "subOpcao", "qtdKit",
          "custoMaterial", "custoMaoObra", "custoEmbalagem", "custoArte", "custoTotal",
          "impostos", "precoVenda", "emPromo", "descontoPct", "precoPromocional", "metaVendas"
        ) VALUES (
          ${novaVarId}, ${novoProdutoId},
          ${v.tipo ?? null}, ${Boolean(v.isKit)}, ${v.canal ?? null},
          ${v.subOpcao ?? null}, ${v.qtdKit ? Number(v.qtdKit) : null},
          ${v.custoMaterial  ? parseFloat(String(v.custoMaterial))  : 0},
          ${v.custoMaoObra   ? parseFloat(String(v.custoMaoObra))   : 0},
          ${v.custoEmbalagem ? parseFloat(String(v.custoEmbalagem)) : 0},
          ${v.custoArte      ? parseFloat(String(v.custoArte))      : 0},
          ${v.custoTotal     ? parseFloat(String(v.custoTotal))     : 0},
          ${v.impostos       ? parseFloat(String(v.impostos))       : 0},
          ${v.precoVenda     ? parseFloat(String(v.precoVenda))     : 0},
          ${Boolean(v.emPromo)},
          ${v.descontoPct    ? parseFloat(String(v.descontoPct))    : 0},
          ${v.precoPromocional ? parseFloat(String(v.precoPromocional)) : null},
          ${v.metaVendas     ? parseFloat(String(v.metaVendas))     : null}
        )
      `

      // Copia materiais da variação
      const materiais = await prisma.$queryRaw`
        SELECT * FROM "PrecMaterialItem" WHERE "variacaoId" = ${v.id}
      ` as any[]

      for (const m of materiais) {
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem"
            ("id", "variacaoId", "materialId", "nomeMaterial", "qtdUsada", "custoUnit", "rendimento")
          VALUES
            (${gerarId()}, ${novaVarId}, ${m.materialId ?? null}, ${m.nomeMaterial ?? ''},
             ${parseFloat(String(m.qtdUsada ?? 1))},
             ${parseFloat(String(m.custoUnit ?? 0))},
             ${parseFloat(String(m.rendimento ?? 1))})
        `
      }

      // Copia kit items da variação
      const kitItens = await prisma.$queryRaw`
        SELECT * FROM "PrecKitItem" WHERE "variacaoId" = ${v.id}
      ` as any[]

      for (const k of kitItens) {
        await prisma.$executeRaw`
          INSERT INTO "PrecKitItem"
            ("id", "variacaoId", "produtoId", "nomeProduto", "qtdItens", "custoUnit")
          VALUES
            (${gerarId()}, ${novaVarId}, ${k.produtoId ?? null}, ${k.nomeProduto ?? ''},
             ${Number(k.qtdItens ?? 1)},
             ${parseFloat(String(k.custoUnit ?? 0))})
        `
      }
    }

    const novoProduto = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto" WHERE "id" = ${novoProdutoId}
    ` as any[]

    return NextResponse.json(serialize(novoProduto[0]))
  } catch (e) {
    console.error('POST /api/precificacao/produtos/[id] (copiar):', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
