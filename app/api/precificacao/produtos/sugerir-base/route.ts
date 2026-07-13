import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

// GET ?nome=<texto> — sugere os produtos cadastrados mais parecidos com o nome (para
// "criar copiando de um irmão"). Similaridade por tokens normalizados (Jaccard). A palavra
// do TEMA (que muda) naturalmente não sobrepõe; os tokens da base ("kit sem laço 36…") sim.
function tokens(s: string): Set<string> {
  return new Set(normNome(s).replace(/[()—–\-·|]/g, ' ').split(/\s+/).filter(t => t.length >= 2))
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const nome = new URL(req.url).searchParams.get('nome') || ''
    const alvo = tokens(nome)
    if (alvo.size === 0) return NextResponse.json({ sugestoes: [] })

    // Só produtos que têm variação com preço (copiáveis de forma útil)
    const produtos = await prisma.$queryRaw`
      SELECT p."id", p."nome"
      FROM "PrecProduto" p
      WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
        AND EXISTS (SELECT 1 FROM "PrecVariacao" v WHERE v."produtoId" = p."id" AND COALESCE(v."precoVenda",0) > 0)
    ` as { id: string; nome: string }[]

    const scored = produtos.map(p => {
      const t = tokens(p.nome)
      let inter = 0
      for (const x of alvo) if (t.has(x)) inter++
      const uniao = alvo.size + t.size - inter
      const score = uniao > 0 ? inter / uniao : 0
      return { id: p.id, nome: p.nome, score }
    }).filter(s => s.score > 0.15)   // corta ruído
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    return NextResponse.json({ sugestoes: scored.map(s => ({ id: s.id, nome: s.nome, score: Math.round(s.score * 100) })) })
  } catch (e) {
    console.error('[produtos/sugerir-base GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
