// Notas pessoais (Evernote): cadernos + tags + busca + rich text (HTML). Escopo por userId.
// GET aceita ?caderno=&tag=&q=&arquivadas=1&favoritas=1  · POST cria (conteudo = HTML; resumo derivado).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, resumoDeHtml } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const caderno = sp.get('caderno') || ''
  const tag = sp.get('tag') || ''
  const q = (sp.get('q') || '').trim()
  const arquivadas = sp.get('arquivadas') === '1'
  const favoritas = sp.get('favoritas') === '1'

  const where: string[] = [`n."userId" = $1`]
  const vals: any[] = [g.userId]
  where.push(arquivadas ? `n."arquivada" = true` : `n."arquivada" = false`)
  if (favoritas) where.push(`n."favorita" = true`)
  if (caderno === 'sem') where.push(`n."cadernoId" IS NULL`)
  else if (caderno) { vals.push(caderno); where.push(`n."cadernoId" = $${vals.length}`) }
  if (tag) { vals.push(tag); where.push(`EXISTS (SELECT 1 FROM "PessoalNotaTag" x WHERE x."notaId" = n."id" AND x."tagId" = $${vals.length})`) }
  if (q) { vals.push(`%${q}%`); const p = `$${vals.length}`; where.push(`(n."titulo" ILIKE ${p} OR n."resumo" ILIKE ${p} OR n."conteudo" ILIKE ${p})`) }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT n."id", n."titulo", n."resumo", n."cor", n."fixada", n."favorita", n."arquivada", n."cadernoId",
           (n."imagem" IS NOT NULL) AS "temImagem", n."updatedAt", n."createdAt",
           COALESCE((SELECT json_agg(json_build_object('id', t."id", 'nome', t."nome", 'cor', t."cor") ORDER BY t."nome")
                     FROM "PessoalNotaTag" nt JOIN "PessoalTag" t ON t."id" = nt."tagId"
                     WHERE nt."notaId" = n."id"), '[]') AS "tags"
    FROM "PessoalNota" n
    WHERE ${where.join(' AND ')}
    ORDER BY n."fixada" DESC, n."updatedAt" DESC
  `, ...vals)
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const titulo = (b?.titulo ? String(b.titulo).trim() : '') || null
  const conteudo = (b?.conteudo ? String(b.conteudo) : '') || null
  let imagem: string | null
  try { imagem = (normalizarImagemEntrada(b?.imagem) ?? null) as string | null }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  if (!titulo && !conteudo && !imagem) return NextResponse.json({ error: 'Nota vazia' }, { status: 400 })
  const resumo = resumoDeHtml(conteudo) || null
  const cadernoId = b?.cadernoId ? String(b.cadernoId) : null
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalNota" ("id","userId","titulo","conteudo","resumo","cadernoId","cor","fixada","imagem","createdAt","updatedAt")
    VALUES (${id}, ${g.userId}, ${titulo}, ${conteudo}, ${resumo}, ${cadernoId}, ${b?.cor || null}, ${!!b?.fixada}, ${imagem}, NOW(), NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
