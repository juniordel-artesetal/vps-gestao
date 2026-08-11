import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureTempoMinutos } from '@/lib/precVariacaoTempo'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    const rows = await prisma.$queryRaw`
      SELECT
        v.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id',          mi."id",
              'materialId',  mi."materialId",
              'nomeMaterial',mi."nomeMaterial",
              'qtdUsada',    mi."qtdUsada",
              'custoUnit',   mi."custoUnit",
              'rendimento',  mi."rendimento"
            )
          ) FILTER (WHERE mi."id" IS NOT NULL),
          '[]'
        ) AS "materiais"
      FROM "PrecVariacao" v
      LEFT JOIN "PrecMaterialItem" mi ON mi."variacaoId" = v."id"
      WHERE v."id" = ${id}
      GROUP BY v."id"
    ` as any[]

    if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    
    const row = serialize(rows[0])
    // Parse custosAdicionais JSON string
    if (typeof row.custosAdicionais === 'string') {
      try { row.custosAdicionais = JSON.parse(row.custosAdicionais) } catch { row.custosAdicionais = [] }
    }
    return NextResponse.json(row)
  } catch (error) {
    console.error('[GET variacao id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    const {
      tipo, isKit, canal, subOpcao, qtdKit, nome,
      custoMaterial, custoMaoObra, custoEmbalagem, custoArte,
      impostos, precoVenda, emPromo, descontoPct, materiais,
      peso, usuarioNome, custosAdicionais, embalagemIds, tempoMinutos,
    } = await req.json()
    await ensureTempoMinutos()

    const atual = await prisma.$queryRaw`
      SELECT "id","nome","canal","subOpcao","tipo","isKit","qtdKit",
             "custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal",
             "impostos","precoVenda","emPromo","descontoPct","precoPromocional","peso"
      FROM "PrecVariacao" WHERE "id" = ${id}
    ` as any[]
    const varAtual = atual[0]

    // Só entradas do tipo "custo (R$)" somam ao custo. As do tipo "taxa (%)"
    // NÃO entram no custo — pertencem à fórmula de preço (somam à taxa do canal).
    const custoAdicional = Array.isArray(custosAdicionais)
      ? custosAdicionais.filter((c: any) => c.tipo !== 'taxa').reduce((s: number, c: any) => s + Number(c.valor || 0), 0)
      : 0
    const custoTotal    = Number(custoMaterial||0) + Number(custoMaoObra||0) + Number(custoEmbalagem||0) + Number(custoArte||0) + custoAdicional
    const precoVendaNum = precoVenda ? Number(precoVenda) : 0
    const descontoNum   = descontoPct ? Number(descontoPct) : null
    const precoPromo    = emPromo && precoVendaNum && descontoNum ? precoVendaNum * (1 - descontoNum / 100) : null
    const pesoNum       = peso ? Number(peso) : null
    const custosAdicionaisJson = Array.isArray(custosAdicionais) && custosAdicionais.length > 0
      ? JSON.stringify(custosAdicionais)
      : null
    const embalagemIdsJson = Array.isArray(embalagemIds) && embalagemIds.length > 0
      ? JSON.stringify(embalagemIds)
      : null

    await prisma.$executeRaw`
      UPDATE "PrecVariacao" SET
        "nome"              = ${nome||null},
        "tipo"              = ${tipo||'UNITARIO'},
        "isKit"             = ${isKit?true:false},
        "canal"             = ${canal||'shopee'},
        "subOpcao"          = ${subOpcao||'classico'},
        "qtdKit"            = ${Number(qtdKit||1)},
        "custoMaterial"     = ${Number(custoMaterial||0)},
        "custoMaoObra"      = ${Number(custoMaoObra||0)},
        "custoEmbalagem"    = ${Number(custoEmbalagem||0)},
        "custoArte"         = ${Number(custoArte||0)},
        "custoTotal"        = ${custoTotal},
        "impostos"          = ${Number(impostos||0)},
        "precoVenda"        = ${precoVendaNum},
        "emPromo"           = ${emPromo?true:false},
        "descontoPct"       = ${descontoNum},
        "precoPromocional"  = ${precoPromo},
        "peso"              = ${pesoNum},
        "custosAdicionais"  = ${custosAdicionaisJson},
        "embalagemIds"      = ${embalagemIdsJson},
        "tempoMinutos"      = ${Math.max(0, Math.round(Number(tempoMinutos) || 0))}
      WHERE "id" = ${id}
    `

    if (varAtual) {
      const campos = [
        { campo: 'precoVenda', antes: varAtual.precoVenda, depois: precoVendaNum },
        { campo: 'custoTotal', antes: varAtual.custoTotal, depois: custoTotal    },
        { campo: 'impostos',   antes: varAtual.impostos,   depois: Number(impostos||0) },
        { campo: 'canal',      antes: varAtual.canal,      depois: canal         },
        { campo: 'peso',       antes: varAtual.peso,       depois: pesoNum       },
      ]
      for (const { campo, antes, depois } of campos) {
        const antesStr  = antes  != null ? String(antes)  : null
        const depoisStr = depois != null ? String(depois) : null
        if (antesStr !== depoisStr) {
          const hid = Math.random().toString(36).slice(2) + Date.now().toString(36)
          const nomeUsr = usuarioNome || null
          await prisma.$executeRaw`
            INSERT INTO "PrecVariacaoHistorico"
              ("id","variacaoId","campo","valorAntes","valorDepois","usuarioNome")
            VALUES (${hid}, ${id}, ${campo}, ${antesStr}, ${depoisStr}, ${nomeUsr})
          `
        }
      }
    }

    await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId" = ${id}`
    if (Array.isArray(materiais)) {
      for (const m of materiais) {
        const mid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem"
            ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
          VALUES
            (${mid}, ${id}, ${m.materialId||null}, ${m.nomeMaterial||''},
             ${Number(m.qtdUsada||0)}, ${Number(m.custoUnit||0)}, ${Number(m.rendimento||1)})
        `
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT variacao id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    await prisma.$executeRaw`DELETE FROM "PrecMaterialItem" WHERE "variacaoId" = ${id}`
    await prisma.$executeRaw`DELETE FROM "PrecVariacao" WHERE "id" = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
