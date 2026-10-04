// Método MAE — receitas dos TEMAS no Neon (mae_themes), por conta e por versão. Só o JSON do tema
// (papéis e elementos vão por caminho + hash; os arquivos ficam na Biblioteca da usuária).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { DocTema } from '@/lib/mae/schema'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const linhas = await prisma.$queryRaw`
      SELECT DISTINCT ON (id) id, version, nome, base_id, base_version, atualizado_em
      FROM mae_themes WHERE workspace_id = ${c.workspaceId}
      ORDER BY id, version DESC`
    return NextResponse.json({ temas: serialize(linhas) })
  } catch (e) {
    console.error('[MAE TEMAS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os temas' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let doc
  try {
    const r = DocTema.safeParse((await lerJson(req) as { doc?: unknown })?.doc)
    if (!r.success) return NextResponse.json({ error: 'Receita de tema inválida', detalhes: r.error.issues.slice(0, 5) }, { status: 400 })
    doc = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    await prisma.$executeRaw`
      INSERT INTO mae_themes (workspace_id, id, version, base_id, base_version, nome, doc)
      VALUES (${c.workspaceId}, ${doc.id}, ${doc.version}, ${doc.baseId}, ${doc.baseVersion}, ${doc.name ?? doc.id}, ${JSON.stringify(doc)}::jsonb)
      ON CONFLICT (workspace_id, id, version) DO UPDATE SET nome = EXCLUDED.nome, doc = EXCLUDED.doc, base_id = EXCLUDED.base_id, base_version = EXCLUDED.base_version, atualizado_em = now()`
    return NextResponse.json({ ok: true, id: doc.id, version: doc.version })
  } catch (e) {
    console.error('[MAE TEMAS PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar o tema' }, { status: 500 })
  }
}
