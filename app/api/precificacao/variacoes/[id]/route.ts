// app/api/precificacao/variacoes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const { tipo, isKit, canal, subOpcao, qtdKit, custoMaterial, custoMaoObra, custoEmbalagem, custoArte, impostos, precoVenda, emPromo, descontoPct, materiais } = await req.json()
    const custoTotal    = Number(custoMaterial||0) + Number(custoMaoObra||0) + Number(custoEmbalagem||0) + Number(custoArte||0)
    const precoVendaNum = precoVenda ? Number(precoVenda) : null
    const descontoNum   = descontoPct ? Number(descontoPct) : null
    const precoPromo    = emPromo && precoVendaNum && descontoNum ? precoVendaNum * (1 - descontoNum / 100) : null

    const [anterior] = await prisma.$queryRaw`
      SELECT "precoVenda","emPromo","descontoPct","precoPromocional","custoTotal"::float,"impostos"::float,"canal","subOpcao","qtdKit"
      FROM "PrecVariacao" WHERE "id"=${id}
    ` as any[]

    await prisma.$executeRaw`
      UPDATE "PrecVariacao" SET
        "tipo"=${tipo||'UNITARIO'}, "isKit"=${isKit?true:false},
        "canal"=${canal||'shopee'}, "subOpcao"=${subOpcao||'classico'}, "qtdKit"=${Number(qtdKit||1)},
        "custoMaterial"=${Number(custoMaterial||0)}, "custoMaoObra"=${Number(custoMaoObra||0)},
        "custoEmbalagem"=${Number(custoEmbalagem||0)}, "custoArte"=${Number(custoArte||0)},
        "custoTotal"=${custoTotal}, "impostos"=${Number(impostos||0)},
        "precoVenda"=${precoVendaNum}, "emPromo"=${emPromo?true:false},
        "descontoPct"=${descontoNum}, "precoPromocional"=${precoPromo}
      WHERE "id"=${id}
    `

    // Histórico de alterações — usa nome real do usuário
    try {
      const campos: Record<string, [any, any]> = {
        'Preço de Venda': [anterior?.precoVenda, precoVendaNum],
        'Em Promoção':    [anterior?.emPromo, emPromo?true:false],
        'Desconto %':     [anterior?.descontoPct, descontoNum],
        'Custo Total':    [anterior?.custoTotal, custoTotal],
        'Impostos':       [anterior?.impostos, Number(impostos||0)],
        'Canal':          [anterior?.canal, canal||'shopee'],
        'Qtd Kit':        [anterior?.qtdKit, Number(qtdKit||1)],
      }
      for (const [campo, [antes, depois]] of Object.entries(campos)) {
        const antesStr  = antes  != null ? String(antes)  : null
        const depoisStr = depois != null ? String(depois) : null
        if (antesStr !== depoisStr) {
          const hid = Math.random().toString(36).slice(2) + Date.now().toString(36)
          await prisma.$executeRaw`
            INSERT INTO "PrecVariacaoHistorico" ("id","variacaoId","campo","valorAntes","valorDepois","usuarioNome","createdAt")
            VALUES (${hid}, ${id}, ${campo}, ${antesStr}, ${depoisStr}, ${session.user.name||'Admin'}, NOW())
          `
        }
      }
    } catch (_) {}

    await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId"=${id}`
    if (Array.isArray(materiais)) {
      for (const m of materiais) {
        const mid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
          VALUES (${mid}, ${id}, ${m.materialId||null}, ${m.nomeMaterial||''}, ${Number(m.qtdUsada||0)}, ${Number(m.custoUnit||0)}, ${Number(m.rendimento||1)})
        `
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const { precoVenda } = await req.json()
    await prisma.$executeRaw`UPDATE "PrecVariacao" SET "precoVenda"=${Number(precoVenda)} WHERE "id"=${id}`
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    await prisma.$executeRaw`DELETE FROM "PrecVariacao" WHERE "id"=${id}`
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
