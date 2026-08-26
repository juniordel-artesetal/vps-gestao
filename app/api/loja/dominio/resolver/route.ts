// PÚBLICO — resolve um Host (domínio próprio ATIVO) para o slug da loja.
// Chamado pelo middleware pra reescrever o domínio custom → /loja/{slug}.
// Só devolve slug de domínio ATIVO cuja loja esteja ativa e com o módulo ligado.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureLojaDominioSchema } from '@/lib/lojaDominio'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const host = (new URL(req.url).searchParams.get('host') || '').toLowerCase().trim().split(':')[0]
  if (!host) return NextResponse.json({ slug: null }, { status: 404 })

  try {
    await ensureLojaDominioSchema()
    const [row] = await prisma.$queryRaw`
      SELECT lc."slug"
      FROM "LojaDominio" ld
      JOIN "LojaConfig" lc ON lc."workspaceId" = ld."workspaceId"
      JOIN "Workspace" w ON w."id" = ld."workspaceId"
      WHERE ld."dominio" = ${host} AND ld."status" = 'ATIVO'
        AND lc."ativo" = true AND w."moduloLoja" = true
      LIMIT 1
    ` as { slug: string }[]
    if (!row?.slug) return NextResponse.json({ slug: null }, { status: 404 })
    // Cache curto na borda — o mapeamento host→slug muda raramente.
    return NextResponse.json({ slug: row.slug }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (e: any) {
    console.error('[LOJA-DOMINIO resolver]', e?.message)
    return NextResponse.json({ slug: null }, { status: 404 })
  }
}
