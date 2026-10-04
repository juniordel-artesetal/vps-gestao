// Método MAE — receitas das BASES no Neon (mae_bases), por conta (workspace) e por versão.
// GET: a última versão de cada base · PUT: grava a versão enviada (validada pelo mesmo Zod do editor).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { DocBase } from '@/lib/mae/schema'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const linhas = await prisma.$queryRaw`
      SELECT DISTINCT ON (id) id, version, nome, atualizado_em
      FROM mae_bases WHERE workspace_id = ${c.workspaceId}
      ORDER BY id, version DESC`
    return NextResponse.json({ bases: serialize(linhas) })
  } catch (e) {
    console.error('[MAE BASES GET]', e)
    return NextResponse.json({ error: 'Erro ao listar as bases' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let doc
  try {
    const r = DocBase.safeParse((await lerJson(req) as { doc?: unknown })?.doc)
    if (!r.success) return NextResponse.json({ error: 'Receita de base inválida', detalhes: r.error.issues.slice(0, 5) }, { status: 400 })
    doc = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    await prisma.$executeRaw`
      INSERT INTO mae_bases (workspace_id, id, version, nome, doc)
      VALUES (${c.workspaceId}, ${doc.id}, ${doc.version}, ${doc.name}, ${JSON.stringify(doc)}::jsonb)
      ON CONFLICT (workspace_id, id, version) DO UPDATE SET nome = EXCLUDED.nome, doc = EXCLUDED.doc, atualizado_em = now()`
    return NextResponse.json({ ok: true, id: doc.id, version: doc.version })
  } catch (e) {
    console.error('[MAE BASES PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar a base' }, { status: 500 })
  }
}
