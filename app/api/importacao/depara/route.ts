import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { normNome } from '@/lib/normNome'

// De-para PERSISTENTE nome→variação para a importação. Reutiliza MarketplaceProdutoVinculo
// (workspaceId, canal, chaveExterna = nome normalizado, variacaoId). Sem tabela nova.
function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET ?canal=shopee — lista os vínculos salvos (nome normalizado → variação + rótulo)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const canal = new URL(req.url).searchParams.get('canal')

    const rows = await prisma.$queryRaw`
      SELECT mv."chaveExterna", mv."variacaoId", mv."canal",
             p."nome" AS "produtoNome", v."nome" AS "variacaoNome"
      FROM "MarketplaceProdutoVinculo" mv
      LEFT JOIN "PrecVariacao" v ON v."id" = mv."variacaoId"
      LEFT JOIN "PrecProduto"  p ON p."id" = v."produtoId"
      WHERE mv."workspaceId" = ${workspaceId}
        AND (${canal}::text IS NULL OR mv."canal" = ${canal})
    ` as any[]

    const itens = rows.map(r => ({
      nomeNormalizado: r.chaveExterna,
      variacaoId: r.variacaoId,
      canal: r.canal,
      label: r.produtoNome ? (r.variacaoNome ? `${r.produtoNome} — ${r.variacaoNome}` : r.produtoNome) : null,
    }))
    return NextResponse.json(serialize({ itens }))
  } catch (e) {
    console.error('[importacao/depara GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST { canal, nome, variacaoId } — salva/atualiza o vínculo (upsert por nome normalizado).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { canal, nome, variacaoId } = await req.json()
    const chave = normNome(nome)
    const canalFinal = String(canal || 'shopee').trim().slice(0, 40) || 'shopee'
    if (!chave || !variacaoId) return NextResponse.json({ error: 'Nome e variação são obrigatórios' }, { status: 400 })

    // Só variação do próprio workspace
    const [v] = await prisma.$queryRaw`
      SELECT v."id" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${variacaoId} AND p."workspaceId" = ${workspaceId} LIMIT 1` as any[]
    if (!v) return NextResponse.json({ error: 'Variação não encontrada' }, { status: 404 })

    await prisma.$executeRaw`
      INSERT INTO "MarketplaceProdutoVinculo" ("id","workspaceId","canal","chaveExterna","variacaoId","createdAt")
      VALUES (${gerarId()}, ${workspaceId}, ${canalFinal}, ${chave}, ${variacaoId}, NOW())
      ON CONFLICT ("workspaceId","canal","chaveExterna")
      DO UPDATE SET "variacaoId" = EXCLUDED."variacaoId"
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[importacao/depara POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
