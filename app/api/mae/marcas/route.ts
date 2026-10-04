// Método MAE — MARCAS DE REGISTRO (mae_registration_presets): a folha (mm), o caminho e o hash do PDF
// (o arquivo fica na Biblioteca, em "Marcas de registro/"), a página e as zonas com tinta. Por conta.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

const Zona = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
const Marca = z.object({
  id: z.string().min(1).max(64), nome: z.string().min(1).max(120), path: z.string().min(1).max(500), sha256: z.string().min(4).max(64),
  wMm: z.number().positive().max(2000), hMm: z.number().positive().max(2000), pagina: z.number().int().positive().max(99).default(1),
  zonas: z.array(Zona).max(400).default([]),
})
type Linha = { id: string; folha_w_mm: number; folha_h_mm: number; nome_arquivo: string; sha256: string; area_livre: { nome?: string; pagina?: number; zonas?: unknown[] } | null }

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const ls = serialize(await prisma.$queryRaw<Linha[]>`SELECT * FROM mae_registration_presets WHERE workspace_id = ${c.workspaceId} ORDER BY criado_em`) as Linha[]
    return NextResponse.json({ marcas: ls.map(l => ({ id: l.id, nome: l.area_livre?.nome ?? l.nome_arquivo.split('/').pop(), path: l.nome_arquivo, sha256: l.sha256, wMm: l.folha_w_mm, hMm: l.folha_h_mm, pagina: l.area_livre?.pagina ?? 1, zonas: l.area_livre?.zonas ?? [] })) })
  } catch (e) {
    console.error('[MAE MARCAS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar as marcas' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let m
  try {
    const r = Marca.safeParse((await lerJson(req, 200_000) as { marca?: unknown })?.marca)
    if (!r.success) return NextResponse.json({ error: 'Marca inválida' }, { status: 400 })
    m = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    const dono = await prisma.$queryRaw<{ workspace_id: string }[]>`SELECT workspace_id FROM mae_registration_presets WHERE id = ${m.id}`
    if (dono.length && dono[0].workspace_id !== c.workspaceId) return NextResponse.json({ error: 'Marca de outra conta' }, { status: 403 })
    const extra = JSON.stringify({ nome: m.nome, pagina: m.pagina, zonas: m.zonas })
    await prisma.$executeRaw`
      INSERT INTO mae_registration_presets (id, workspace_id, folha_w_mm, folha_h_mm, nome_arquivo, sha256, area_livre)
      VALUES (${m.id}, ${c.workspaceId}, ${m.wMm}, ${m.hMm}, ${m.path}, ${m.sha256}, ${extra}::jsonb)
      ON CONFLICT (id) DO UPDATE SET folha_w_mm = EXCLUDED.folha_w_mm, folha_h_mm = EXCLUDED.folha_h_mm, nome_arquivo = EXCLUDED.nome_arquivo, sha256 = EXCLUDED.sha256, area_livre = EXCLUDED.area_livre`
    return NextResponse.json({ ok: true, id: m.id })
  } catch (e) {
    console.error('[MAE MARCAS PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar a marca' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    await prisma.$executeRaw`DELETE FROM mae_registration_presets WHERE id = ${id} AND workspace_id = ${c.workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE MARCAS DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir a marca' }, { status: 500 })
  }
}
