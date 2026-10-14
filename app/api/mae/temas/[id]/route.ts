// Método MAE — um tema (mae_themes): a última versão, ou ?v=N. Lote 13 (item 186): ?uso=1 e POST excluir/restaurar.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contaMae, recusa, lerJson } from '@/lib/mae/servidor/acesso'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  const v = Number(req.nextUrl.searchParams.get('v')) || null
  try {
    // Lote 13 (item 186): quantos pedidos e produtos usam este tema (antes de excluir)
    if (req.nextUrl.searchParams.get('uso')) return NextResponse.json(await usoDoTema(c.workspaceId, id))
    // proteção contra perda (12/10/2026): as versões salvas na nuvem, para restaurar uma anterior
    if (req.nextUrl.searchParams.get('versoes')) {
      const versoes = await prisma.$queryRaw<{ version: number; atualizado_em: Date }[]>`SELECT version, atualizado_em FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC`
      return NextResponse.json({ versoes: versoes.map(x => ({ versao: x.version, em: x.atualizado_em })) })
    }
    const linhas = v
      ? await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${id} AND version = ${v}`
      : await prisma.$queryRaw<{ doc: unknown }[]>`SELECT doc FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${id} ORDER BY version DESC LIMIT 1`
    if (!linhas.length) return recusa('temas/[id]', { error: 'Tema não encontrado' }, 404)
    return NextResponse.json({ doc: linhas[0].doc })
  } catch (e) {
    console.error('[MAE TEMA GET]', e)
    return NextResponse.json({ error: 'Erro ao abrir o tema' }, { status: 500 })
  }
}

/** Lote 13 (item 186): pedidos (SOA e MAE avulso) com este tema escolhido + produtos vinculados a ele. */
async function usoDoTema(ws: string, id: string): Promise<{ pedidos: number; produtos: number }> {
  const [p] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM "Order" WHERE "workspaceId" = ${ws} AND "camposExtras" LIKE ${'%' + id + '%'}
      AND ("camposExtras"::jsonb #>> '{_mae,temaId}') = ${id}`
  const [m] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM mae_orders WHERE workspace_id = ${ws} AND ajustes->>'temaId' = ${id}`
  const [v] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM mae_product_theme_links WHERE workspace_id = ${ws} AND theme_id = ${id}`
  return { pedidos: (p?.n ?? 0) + (m?.n ?? 0), produtos: v?.n ?? 0 }
}

/**
 * Lote 13 (item 186): EXCLUIR (para a lixeira, 30 dias) ou RESTAURAR um tema. Antes de excluir, os pedidos e produtos
 * que usam o tema podem passar para outro (`substituto`) — sem isso e com uso, recusa (a tela pede a escolha).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const { id } = await params
  let b: { acao?: string; substituto?: string | null }
  try { b = (await lerJson(req, 10_000)) as typeof b } catch { return recusa('temas/[id]', { error: 'JSON inválido' }, 400) }
  try {
    if (b.acao === 'restaurar') {
      await prisma.$executeRaw`UPDATE mae_themes SET doc = doc - '_lixeira' WHERE workspace_id = ${c.workspaceId} AND id = ${id}`
      return NextResponse.json({ ok: true })
    }
    if (b.acao !== 'excluir') return recusa('temas/[id]', { error: 'Ação inválida' }, 400)
    const sub = typeof b.substituto === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(b.substituto) && b.substituto !== id ? b.substituto : null
    const uso = await usoDoTema(c.workspaceId, id)
    if ((uso.pedidos || uso.produtos) && !sub) return recusa('temas/[id]', { error: 'Este tema está em uso — escolha outro tema para os pedidos e produtos', uso }, 409)
    if (sub) {
      // o substituto tem que existir nesta conta (e fora da lixeira)
      const [ok] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM mae_themes WHERE workspace_id = ${c.workspaceId} AND id = ${sub} AND NOT (doc ? '_lixeira')`
      if (!ok?.n) return recusa('temas/[id]', { error: 'O tema escolhido no lugar não existe' }, 400)
      await prisma.$executeRaw`UPDATE mae_product_theme_links SET theme_id = ${sub} WHERE workspace_id = ${c.workspaceId} AND theme_id = ${id}`
      await prisma.$executeRaw`
        UPDATE "Order" SET "camposExtras" = jsonb_set("camposExtras"::jsonb, '{_mae,temaId}', to_jsonb(${sub}::text))::text
        WHERE "workspaceId" = ${c.workspaceId} AND "camposExtras" LIKE ${'%' + id + '%'} AND ("camposExtras"::jsonb #>> '{_mae,temaId}') = ${id}`
      await prisma.$executeRaw`UPDATE mae_orders SET ajustes = jsonb_set(ajustes, '{temaId}', to_jsonb(${sub}::text)) WHERE workspace_id = ${c.workspaceId} AND ajustes->>'temaId' = ${id}`
    }
    await prisma.$executeRaw`UPDATE mae_themes SET doc = doc || jsonb_build_object('_lixeira', now()) WHERE workspace_id = ${c.workspaceId} AND id = ${id}`
    return NextResponse.json({ ok: true, movidos: sub ? uso : { pedidos: 0, produtos: 0 } })
  } catch (e) {
    console.error('[MAE TEMA POST]', e)
    return NextResponse.json({ error: 'Erro ao excluir/restaurar o tema' }, { status: 500 })
  }
}
