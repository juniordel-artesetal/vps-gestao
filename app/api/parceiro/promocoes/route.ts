import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { getParceiroSessao } from '@/lib/parceiros/auth'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — promoções do parceiro logado (sem a imagem na listagem; só sob demanda).
export async function GET() {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "id","titulo","descricao","cupom","linkCompra","prioridade",
           TO_CHAR("dataInicio",'YYYY-MM-DD') AS "dataInicio",
           TO_CHAR("dataFim",'YYYY-MM-DD') AS "dataFim",
           "ativo","impressoes","cliques", ("imagem" IS NOT NULL) AS "temImagem"
    FROM "DistribuidorPromocao" WHERE "parceiroId" = ${parceiroId}
    ORDER BY "ativo" DESC, "prioridade" DESC, "createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria/edita promoção. A PRIORIDADE não é editável aqui (é do Master).
// body: { id?, titulo, descricao, imagem?, cupom, linkCompra, dataInicio?, dataFim?, ativo }
export async function POST(req: NextRequest) {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const titulo = String(b.titulo || '').trim()
  if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  const di = b.dataInicio ? String(b.dataInicio) : null
  const df = b.dataFim ? String(b.dataFim) : null

  if (b.id) {
    const [own] = await prisma.$queryRaw`SELECT "id" FROM "DistribuidorPromocao" WHERE "id" = ${String(b.id)} AND "parceiroId" = ${parceiroId} LIMIT 1` as any[]
    if (!own) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    // imagem só é sobrescrita se enviada
    await prisma.$executeRaw`
      UPDATE "DistribuidorPromocao"
      SET "titulo" = ${titulo}, "descricao" = ${b.descricao ?? null}, "cupom" = ${b.cupom ?? null},
          "linkCompra" = ${b.linkCompra ?? null}, "dataInicio" = ${di}::date, "dataFim" = ${df}::date,
          "ativo" = ${b.ativo !== false},
          "imagem" = COALESCE(${b.imagem ?? null}, "imagem")
      WHERE "id" = ${String(b.id)} AND "parceiroId" = ${parceiroId}
    `
    return NextResponse.json({ ok: true, id: b.id })
  }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "DistribuidorPromocao" ("id","parceiroId","titulo","descricao","imagem","cupom","linkCompra",
                                        "prioridade","dataInicio","dataFim","ativo","createdAt")
    VALUES (${id}, ${parceiroId}, ${titulo}, ${b.descricao ?? null}, ${b.imagem ?? null}, ${b.cupom ?? null},
            ${b.linkCompra ?? null}, 0, ${di}::date, ${df}::date, ${b.ativo !== false}, NOW())
  `
  return NextResponse.json({ ok: true, id })
}

export async function DELETE(req: NextRequest) {
  const parceiroId = await getParceiroSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "DistribuidorPromocao" WHERE "id" = ${id} AND "parceiroId" = ${parceiroId}`
  return NextResponse.json({ ok: true })
}
