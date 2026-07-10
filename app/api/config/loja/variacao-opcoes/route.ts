import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureLojaAtributos } from '@/lib/lojaAtributos'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST { variacaoId, mapa: { [atributoId]: opcaoId | null } }
// Substitui o mapeamento da variação. Valida: opção pertence ao atributo; atributo é do
// mesmo produto; combinação COMPLETA não pode colidir com a de outra variação (erro claro).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureLojaAtributos()
    const workspaceId = session.user.workspaceId
    const { variacaoId, mapa } = await req.json()
    if (!variacaoId || typeof mapa !== 'object' || mapa === null)
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

    // Variação do workspace + produto dela
    const [v] = await prisma.$queryRaw`
      SELECT v."id", v."produtoId" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${variacaoId} AND p."workspaceId" = ${workspaceId} LIMIT 1` as any[]
    if (!v) return NextResponse.json({ error: 'Variação não encontrada' }, { status: 404 })

    // Atributos do produto + suas opções válidas
    const atributos = await prisma.$queryRaw`
      SELECT "id" FROM "LojaAtributo" WHERE "produtoId" = ${v.produtoId} AND "workspaceId" = ${workspaceId}` as any[]
    const atrIds = new Set(atributos.map((a: any) => a.id))
    const opcoes = atrIds.size ? await prisma.$queryRaw`
      SELECT "id","atributoId" FROM "LojaAtributoOpcao" WHERE "atributoId" = ANY(${Array.from(atrIds)}::text[])` as any[] : []
    const opcaoDoAtr = new Map<string, string>()  // opcaoId → atributoId
    for (const o of opcoes) opcaoDoAtr.set(o.id, o.atributoId)

    // Monta pares válidos (uma opção por atributo)
    const pares: { atributoId: string; opcaoId: string }[] = []
    for (const [atributoId, opcaoId] of Object.entries(mapa as Record<string, string | null>)) {
      if (!opcaoId) continue
      if (!atrIds.has(atributoId)) return NextResponse.json({ error: 'Atributo inválido para este produto.' }, { status: 400 })
      if (opcaoDoAtr.get(opcaoId) !== atributoId) return NextResponse.json({ error: 'Opção não pertence ao atributo.' }, { status: 400 })
      pares.push({ atributoId, opcaoId })
    }

    // Combinação COMPLETA (todos os atributos mapeados) → não pode duplicar outra variação
    if (atrIds.size > 0 && pares.length === atrIds.size) {
      const outras = await prisma.$queryRaw`
        SELECT lvo."variacaoId", lvo."atributoId", lvo."opcaoId"
        FROM "LojaVariacaoOpcao" lvo
        JOIN "PrecVariacao" v2 ON v2."id" = lvo."variacaoId"
        WHERE v2."produtoId" = ${v.produtoId} AND lvo."variacaoId" <> ${variacaoId} AND lvo."workspaceId" = ${workspaceId}
      ` as any[]
      const mapaOutras: Record<string, Record<string, string>> = {}
      for (const o of outras) (mapaOutras[o.variacaoId] ||= {})[o.atributoId] = o.opcaoId
      const chaveAtual = Array.from(atrIds).map(a => pares.find(p => p.atributoId === a)!.opcaoId).join('|')
      for (const [, mp] of Object.entries(mapaOutras)) {
        if (Object.keys(mp).length === atrIds.size) {
          const chave = Array.from(atrIds).map(a => mp[a]).join('|')
          if (chave === chaveAtual) return NextResponse.json({ error: 'Essa combinação já está em uso por outra variação.' }, { status: 409 })
        }
      }
    }

    // Substitui o mapeamento
    await prisma.$executeRaw`DELETE FROM "LojaVariacaoOpcao" WHERE "variacaoId" = ${variacaoId} AND "workspaceId" = ${workspaceId}`
    for (const p of pares) {
      await prisma.$executeRaw`
        INSERT INTO "LojaVariacaoOpcao" ("id","workspaceId","variacaoId","atributoId","opcaoId")
        VALUES (${gerarId()}, ${workspaceId}, ${variacaoId}, ${p.atributoId}, ${p.opcaoId})`
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/variacao-opcoes POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
