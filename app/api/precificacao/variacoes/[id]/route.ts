import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — busca variação + materiais
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT v.*, p."workspaceId"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE v."id" = ${id}
      AND p."workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]

  if (rows.length === 0)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const materiais = await prisma.$queryRaw`
    SELECT * FROM "PrecMaterialItem" WHERE "variacaoId" = ${id}
  ` as any[]

  return NextResponse.json(serialize({ ...rows[0], materiais }))
}

// PUT — atualiza variação + materiais
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Verifica pertencimento ao workspace
    const check = await prisma.$queryRaw`
      SELECT v."id" FROM "PrecVariacao" v
      INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${id} AND p."workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (check.length === 0)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const body = await req.json()
    const {
      tipo, isKit, canal, subOpcao, qtdKit,
      custoMaterial, custoMaoObra, custoEmbalagem, custoArte,
      impostos, precoVenda, emPromo, descontoPct,
      materiais,
    } = body

    const custoTotal    = Number(custoMaterial || 0) + Number(custoMaoObra || 0) + Number(custoEmbalagem || 0) + Number(custoArte || 0)
    const precoVendaNum = precoVenda ? Number(precoVenda) : 0
    const descontoNum   = descontoPct ? Number(descontoPct) : null
    const precoPromo    = emPromo && precoVendaNum && descontoNum
      ? precoVendaNum * (1 - descontoNum / 100)
      : null

    await prisma.$executeRaw`
      UPDATE "PrecVariacao" SET
        "tipo"             = ${tipo || 'UNITARIO'},
        "isKit"            = ${isKit ? true : false},
        "canal"            = ${canal || 'shopee'},
        "subOpcao"         = ${subOpcao || 'classico'},
        "qtdKit"           = ${Number(qtdKit || 1)},
        "custoMaterial"    = ${Number(custoMaterial || 0)},
        "custoMaoObra"     = ${Number(custoMaoObra || 0)},
        "custoEmbalagem"   = ${Number(custoEmbalagem || 0)},
        "custoArte"        = ${Number(custoArte || 0)},
        "custoTotal"       = ${custoTotal},
        "impostos"         = ${Number(impostos || 0)},
        "precoVenda"       = ${precoVendaNum},
        "emPromo"          = ${emPromo ? true : false},
        "descontoPct"      = ${descontoNum},
        "precoPromocional" = ${precoPromo}
      WHERE "id" = ${id}
    `

    // Atualiza materiais: apaga os antigos e reinsere
    if (Array.isArray(materiais)) {
      await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId" = ${id}`
      for (const m of materiais) {
        const mid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem"
            ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
          VALUES
            (${mid}, ${id}, ${m.materialId || null}, ${m.nomeMaterial || ''},
             ${Number(m.qtdUsada || 0)}, ${Number(m.custoUnit || 0)}, ${Number(m.rendimento || 1)})
        `
      }
    }

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('[PUT variacoes/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE — remove variação + materiais
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Verifica pertencimento
    const check = await prisma.$queryRaw`
      SELECT v."id" FROM "PrecVariacao" v
      INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${id} AND p."workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (check.length === 0)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId" = ${id}`
    await prisma.$executeRaw`DELETE FROM "PrecVariacao" WHERE "id" = ${id}`

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE variacoes/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
