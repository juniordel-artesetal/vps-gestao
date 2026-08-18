// Editar (autosave parcial: título/conteúdo/caderno/fixar/favoritar/arquivar/cor/tags/imagem) e excluir.
// Escopo por userId. Só toca os campos presentes no body (nunca zera o que não veio).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, resumoDeHtml } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [nota] = await prisma.$queryRaw`
    SELECT n."id", n."titulo", n."conteudo", n."resumo", n."cor", n."fixada", n."favorita", n."arquivada",
           n."cadernoId", (n."imagem" IS NOT NULL) AS "temImagem", n."updatedAt", n."createdAt",
           COALESCE((SELECT json_agg(nt."tagId") FROM "PessoalNotaTag" nt WHERE nt."notaId" = n."id"), '[]') AS "tagIds"
    FROM "PessoalNota" n WHERE n."id" = ${id} AND n."userId" = ${g.userId}
  ` as any[]
  if (!nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  return NextResponse.json(nota)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  // Patch de imagem isolado (anexar/remover).
  if ('imagem' in b) {
    let img: string | null
    try { img = (normalizarImagemEntrada(b.imagem) ?? null) as string | null }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
    await prisma.$executeRaw`UPDATE "PessoalNota" SET "imagem" = ${img}, "updatedAt" = NOW() WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  // Monta SET dinâmico só com o que veio (parcial de verdade).
  const sets: string[] = []
  const vals: any[] = []
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col} = $${vals.length}`) }
  if ('titulo' in b) add(`"titulo"`, String(b.titulo ?? '').trim() || null)
  if ('conteudo' in b) { const c = b.conteudo != null ? String(b.conteudo) : null; add(`"conteudo"`, c); add(`"resumo"`, resumoDeHtml(c) || null) }
  if ('cor' in b) add(`"cor"`, b.cor || null)
  if ('cadernoId' in b) add(`"cadernoId"`, b.cadernoId ? String(b.cadernoId) : null)
  if ('fixada' in b) add(`"fixada"`, !!b.fixada)
  if ('favorita' in b) add(`"favorita"`, !!b.favorita)
  if ('arquivada' in b) add(`"arquivada"`, !!b.arquivada)

  const temTags = Array.isArray(b?.tags)

  if (!sets.length && !temTags) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    if (sets.length) {
      sets.push(`"updatedAt" = NOW()`)
      vals.push(id, g.userId)
      await tx.$executeRawUnsafe(
        `UPDATE "PessoalNota" SET ${sets.join(', ')} WHERE "id" = $${vals.length - 1} AND "userId" = $${vals.length}`,
        ...vals,
      )
    }
    if (temTags) {
      // Confere que a nota é do usuário antes de mexer nos vínculos.
      const [dono] = await tx.$queryRaw`SELECT 1 AS ok FROM "PessoalNota" WHERE "id" = ${id} AND "userId" = ${g.userId}` as any[]
      if (!dono) throw new Error('Nota não encontrada')
      const ids = [...new Set((b.tags as any[]).map(String).filter(Boolean))]
      await tx.$executeRaw`DELETE FROM "PessoalNotaTag" WHERE "notaId" = ${id}`
      for (const tagId of ids) {
        // Só vincula tags do próprio usuário (evita vínculo cross-user).
        await tx.$executeRaw`
          INSERT INTO "PessoalNotaTag" ("notaId","tagId")
          SELECT ${id}, ${tagId} WHERE EXISTS (SELECT 1 FROM "PessoalTag" WHERE "id" = ${tagId} AND "userId" = ${g.userId})
          ON CONFLICT DO NOTHING`
      }
      if (!sets.length) await tx.$executeRaw`UPDATE "PessoalNota" SET "updatedAt" = NOW() WHERE "id" = ${id} AND "userId" = ${g.userId}`
    }
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "PessoalNota" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
