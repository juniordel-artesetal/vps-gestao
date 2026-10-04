// Método MAE — a NATY publica um tema como PACK na Loja (só as contas de MAE_NATY_WORKSPACES). Os arquivos
// do pack já subiram do navegador direto para o Vercel Blob (/api/mae/loja/upload); aqui entra a receita
// com os links, o preço e o nome de cada parte (é pelo nome que o pack encaixa na base da aluna).
// Exceção consciente à regra "nenhuma arte no servidor": são produtos que a Naty VENDE, não arte de aluna.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { DocTema } from '@/lib/mae/schema'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'
import { ehNaty } from '@/lib/mae/servidor/addons'

const Publicar = z.object({
  doc: z.unknown(),
  precoCentavos: z.number().int().min(0).max(100_000).nullable(),
  descricao: z.string().max(500).default(''),
  partes: z.record(z.string().max(64), z.string().min(1).max(60)),
  arquivos: z.array(z.object({ path: z.string().min(1).max(500), url: z.string().url().startsWith('https://'), sha256: z.string().min(4).max(64) })).max(400),
})

export async function POST(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  if (!ehNaty(c.workspaceId)) return NextResponse.json({ error: 'Só a Naty publica na Loja' }, { status: 403 })
  let b
  try {
    const r = Publicar.safeParse(await lerJson(req, 2_000_000))
    if (!r.success) return NextResponse.json({ error: 'Pack inválido', detalhes: r.error.issues.slice(0, 3) }, { status: 400 })
    b = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const t = DocTema.safeParse(b.doc)
  if (!t.success) return NextResponse.json({ error: 'Tema inválido' }, { status: 400 })
  const id = `naty_${t.data.id}`
  try {
    const [u] = await prisma.$queryRaw<{ v: number | null }[]>`SELECT MAX(version) AS v FROM mae_themes WHERE workspace_id = 'naty' AND id = ${id}`
    const version = (u?.v ?? 0) + 1
    const doc = { ...t.data, id, version, loja: { precoCentavos: b.precoCentavos || null, descricao: b.descricao, partes: b.partes, arquivos: b.arquivos } }
    await prisma.$executeRaw`
      INSERT INTO mae_themes (workspace_id, id, version, base_id, base_version, nome, doc, publicado)
      VALUES ('naty', ${id}, ${version}, ${t.data.baseId}, ${t.data.baseVersion}, ${t.data.name ?? t.data.id}, ${JSON.stringify(doc)}::jsonb, true)`
    return NextResponse.json({ ok: true, id, version })
  } catch (e) {
    console.error('[MAE LOJA PUBLICAR]', e)
    return NextResponse.json({ error: 'Erro ao publicar' }, { status: 500 })
  }
}
