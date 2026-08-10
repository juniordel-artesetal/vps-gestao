import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { getParceiroSessao } from '@/lib/parceiros/auth'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — lista de preços do parceiro logado (isolado).
export async function GET() {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","nomeNormalizado","preco"::float AS "preco","unidade","linkCompra","ativo",
           "impressoes","cliques"
    FROM "DistribuidorProduto" WHERE "parceiroId" = ${parceiroId}
    ORDER BY "ativo" DESC, "nome" ASC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria/edita 1 produto OU importa lista (CSV/linhas). body:
//  edição: { id?, nome, preco, unidade, linkCompra, ativo }
//  import: { itens: [{ nome, preco, unidade, linkCompra }] }
export async function POST(req: NextRequest) {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))

  // Importação em lote
  if (Array.isArray(b.itens)) {
    let criados = 0
    for (const it of b.itens) {
      const nome = String(it.nome || '').trim()
      if (!nome) continue
      const preco = it.preco !== undefined && it.preco !== null && it.preco !== '' ? parseFloat(String(it.preco).replace(',', '.')) : null
      await prisma.$executeRaw`
        INSERT INTO "DistribuidorProduto" ("id","parceiroId","nome","nomeNormalizado","preco","unidade","linkCompra","ativo","createdAt")
        VALUES (${gerarId()}, ${parceiroId}, ${nome}, ${normNome(nome)}, ${preco}, ${it.unidade ?? null}, ${it.linkCompra ?? null}, true, NOW())
      `
      criados++
    }
    return NextResponse.json({ ok: true, criados })
  }

  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const preco = b.preco !== undefined && b.preco !== null && b.preco !== '' ? parseFloat(String(b.preco).replace(',', '.')) : null

  if (b.id) {
    // Confere posse antes de editar (isolamento)
    const [own] = await prisma.$queryRaw`SELECT "id" FROM "DistribuidorProduto" WHERE "id" = ${String(b.id)} AND "parceiroId" = ${parceiroId} LIMIT 1` as any[]
    if (!own) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    await prisma.$executeRaw`
      UPDATE "DistribuidorProduto"
      SET "nome" = ${nome}, "nomeNormalizado" = ${normNome(nome)}, "preco" = ${preco},
          "unidade" = ${b.unidade ?? null}, "linkCompra" = ${b.linkCompra ?? null}, "ativo" = ${b.ativo !== false}
      WHERE "id" = ${String(b.id)} AND "parceiroId" = ${parceiroId}
    `
    return NextResponse.json({ ok: true, id: b.id })
  }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "DistribuidorProduto" ("id","parceiroId","nome","nomeNormalizado","preco","unidade","linkCompra","ativo","createdAt")
    VALUES (${id}, ${parceiroId}, ${nome}, ${normNome(nome)}, ${preco}, ${b.unidade ?? null}, ${b.linkCompra ?? null}, ${b.ativo !== false}, NOW())
  `
  return NextResponse.json({ ok: true, id })
}

// DELETE — remove produto do parceiro (isolado). ?id=
export async function DELETE(req: NextRequest) {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "DistribuidorProduto" WHERE "id" = ${id} AND "parceiroId" = ${parceiroId}`
  return NextResponse.json({ ok: true })
}
