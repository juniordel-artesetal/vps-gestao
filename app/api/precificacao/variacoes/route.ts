// app/api/precificacao/variacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { produtoId, tipo, isKit, canal, subOpcao, qtdKit, custoMaterial, custoMaoObra, custoEmbalagem, custoArte, impostos, precoVenda, emPromo, descontoPct, materiais } = await req.json()
    if (!produtoId) return NextResponse.json({ error: 'Produto obrigatório' }, { status: 400 })
    const custoTotal    = Number(custoMaterial||0) + Number(custoMaoObra||0) + Number(custoEmbalagem||0) + Number(custoArte||0)
    const id            = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const precoVendaNum = precoVenda ? Number(precoVenda) : 0   // ← NOT NULL DEFAULT 0 no Neon
    const descontoNum   = descontoPct ? Number(descontoPct) : null
    const precoPromo    = emPromo && precoVendaNum && descontoNum ? precoVendaNum * (1 - descontoNum / 100) : null
    await prisma.$executeRaw`
      INSERT INTO "PrecVariacao" (
        "id","produtoId","tipo","isKit","canal","subOpcao","qtdKit",
        "custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal",
        "impostos","precoVenda","emPromo","descontoPct","precoPromocional","metaVendas"
      ) VALUES (
        ${id}, ${produtoId}, ${tipo||'UNITARIO'}, ${isKit?true:false},
        ${canal||'shopee'}, ${subOpcao||'classico'}, ${Number(qtdKit||1)},
        ${Number(custoMaterial||0)}, ${Number(custoMaoObra||0)}, ${Number(custoEmbalagem||0)}, ${Number(custoArte||0)}, ${custoTotal},
        ${Number(impostos||0)}, ${precoVendaNum}, ${emPromo?true:false}, ${descontoNum}, ${precoPromo}, null
      )
    `
    if (Array.isArray(materiais)) {
      for (const m of materiais) {
        const mid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
          VALUES (${mid}, ${id}, ${m.materialId||null}, ${m.nomeMaterial||''}, ${Number(m.qtdUsada||0)}, ${Number(m.custoUnit||0)}, ${Number(m.rendimento||1)})
        `
      }
    }
    return NextResponse.json({ id })
  } catch (error) {
    console.error('[POST variacoes]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
