// Método MAE — RASCUNHO AUTOMÁTICO no servidor (proteção contra perda). Guarda o trabalho NÃO SALVO de uma base
// ou tema (só a receita JSON; as imagens ficam na Biblioteca). Uma linha por documento, sobrescrita a cada envio.
//   GET                → os rascunhos da conta (sem o doc)        GET ?tipo=&id= → um rascunho (com o doc)
//   PUT {tipo, doc, editadoEm}  → grava (também via fetch keepalive ao fechar a página)
//   DELETE ?tipo=&id=  → apaga (a usuária salvou de verdade, ou descartou)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { DocBase, DocTema } from '@/lib/mae/schema'
import { contaMae, lerJson, recusa } from '@/lib/mae/servidor/acesso'

const TIPOS = new Set(['base', 'tema'])

export async function GET(req: NextRequest) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const tipo = req.nextUrl.searchParams.get('tipo'), id = req.nextUrl.searchParams.get('id')
  try {
    if (tipo && id) {
      const [r] = await prisma.$queryRaw<{ doc: unknown; editado_em: Date }[]>`
        SELECT doc, editado_em FROM mae_rascunhos WHERE workspace_id = ${c.workspaceId} AND tipo = ${tipo} AND doc_id = ${id}`
      if (!r) return recusa('rascunhos', { error: 'Sem rascunho' }, 404)
      return NextResponse.json(serialize({ doc: r.doc, editadoEm: r.editado_em }))
    }
    const linhas = await prisma.$queryRaw`
      SELECT tipo, doc_id AS id, nome, versao, editado_em AS "editadoEm" FROM mae_rascunhos
      WHERE workspace_id = ${c.workspaceId} ORDER BY editado_em DESC`
    return NextResponse.json({ rascunhos: serialize(linhas) })
  } catch (e) {
    console.error('[MAE RASCUNHOS GET]', e)
    return NextResponse.json({ error: 'Erro ao ler os rascunhos' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let corpo: { tipo?: string; doc?: unknown; editadoEm?: number }
  try { corpo = await lerJson(req) as typeof corpo } catch { return recusa('rascunhos', { error: 'JSON inválido' }, 400) }
  const tipo = String(corpo?.tipo ?? '')
  if (!TIPOS.has(tipo)) return recusa('rascunhos', { error: 'Tipo inválido' }, 400)
  const r = (tipo === 'tema' ? DocTema : DocBase).safeParse(corpo.doc)
  if (!r.success) return recusa('rascunhos', { error: 'Receita inválida', detalhes: r.error.issues.slice(0, 5) }, 400)
  const doc = r.data as { id: string; name?: string; version: number }
  const editado = new Date(Number(corpo.editadoEm) || Date.now())
  try {
    // nunca volta no tempo: um envio atrasado (ex.: o do "fechar a página") não sobrescreve um mais novo
    await prisma.$executeRaw`
      INSERT INTO mae_rascunhos (workspace_id, tipo, doc_id, nome, versao, doc, editado_em)
      VALUES (${c.workspaceId}, ${tipo}, ${doc.id}, ${doc.name ?? doc.id}, ${doc.version}, ${JSON.stringify(doc)}::jsonb, ${editado})
      ON CONFLICT (workspace_id, tipo, doc_id) DO UPDATE SET nome = EXCLUDED.nome, versao = EXCLUDED.versao, doc = EXCLUDED.doc,
        editado_em = EXCLUDED.editado_em, atualizado_em = now()
      WHERE mae_rascunhos.editado_em <= EXCLUDED.editado_em`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE RASCUNHOS PUT]', e)
    return NextResponse.json({ error: 'Erro ao guardar o rascunho' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const tipo = req.nextUrl.searchParams.get('tipo'), id = req.nextUrl.searchParams.get('id')
  if (!tipo || !id) return recusa('rascunhos', { error: 'Informe tipo e id' }, 400)
  try {
    await prisma.$executeRaw`DELETE FROM mae_rascunhos WHERE workspace_id = ${c.workspaceId} AND tipo = ${tipo} AND doc_id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE RASCUNHOS DELETE]', e)
    return NextResponse.json({ error: 'Erro ao apagar o rascunho' }, { status: 500 })
  }
}
