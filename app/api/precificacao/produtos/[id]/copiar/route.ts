// app/api/precificacao/produtos/[id]/copiar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function newId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [prod] = await prisma.$queryRaw`
      SELECT * FROM "PrecProduto" WHERE "id"=${id} AND "workspaceId"=${workspaceId}
    ` as any[]
    if (!prod) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const novoProdId = newId()
    await prisma.$executeRaw`
      INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
      VALUES (${novoProdId}, ${workspaceId}, ${`${prod.nome} (cópia)`}, ${prod.sku?`${prod.sku}-COPIA`:null}, ${prod.categoria||null}, true, NOW(), NOW())
    `

    const variacoes: any[] = await prisma.$queryRaw`SELECT * FROM "PrecVariacao" WHERE "produtoId"=${id}`
    for (const v of variacoes) {
      const novaVarId = newId()
      await prisma.$executeRaw`
        INSERT INTO "PrecVariacao" (
          "id","produtoId","tipo","isKit","canal","subOpcao","qtdKit",
          "custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal",
          "impostos","precoVenda","emPromo","descontoPct","precoPromocional","metaVendas","createdAt"
        ) VALUES (
          ${novaVarId}, ${novoProdId}, ${v.tipo}, ${v.isKit}, ${v.canal}, ${v.subOpcao}, ${v.qtdKit},
          ${Number(v.custoMaterial)}, ${Number(v.custoMaoObra)}, ${Number(v.custoEmbalagem)}, ${Number(v.custoArte)}, ${Number(v.custoTotal)},
          ${Number(v.impostos)}, ${v.precoVenda?Number(v.precoVenda):null},
          ${v.emPromo}, ${v.descontoPct?Number(v.descontoPct):null}, ${v.precoPromocional?Number(v.precoPromocional):null},
          ${v.metaVendas||null}, NOW()
        )
      `
      const materiais: any[] = await prisma.$queryRaw`SELECT * FROM "PrecMaterialItem" WHERE "variacaoId"=${v.id}`
      for (const m of materiais) {
        const mid = newId()
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
          VALUES (${mid}, ${novaVarId}, ${m.materialId||null}, ${m.nomeMaterial}, ${Number(m.qtdUsada)}, ${Number(m.custoUnit)}, ${Number(m.rendimento)})
        `
      }
      const kitItens: any[] = await prisma.$queryRaw`SELECT * FROM "PrecKitItem" WHERE "variacaoId"=${v.id}`
      for (const k of kitItens) {
        const kid = newId()
        await prisma.$executeRaw`
          INSERT INTO "PrecKitItem" ("id","variacaoId","produtoId","nomeProduto","qtdItens","custoUnit")
          VALUES (${kid}, ${novaVarId}, ${k.produtoId}, ${k.nomeProduto}, ${k.qtdItens}, ${Number(k.custoUnit)})
        `
      }
    }
    return NextResponse.json({ id: novoProdId, nome: `${prod.nome} (cópia)` }, { status: 201 })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
