// Método MAE — MARCAS DE REGISTRO (mae_registration_presets): a folha (mm), o caminho e o hash do PDF
// (o arquivo fica na Biblioteca, em "Marcas de registro/"), a página e as zonas com tinta. Por conta.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae, lerJson, recusa } from '@/lib/mae/servidor/acesso'

const Zona = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
const Marca = z.object({
  id: z.string().min(1).max(64), nome: z.string().min(1).max(120), path: z.string().min(1).max(500), sha256: z.string().min(4).max(64),
  wMm: z.number().positive().max(2000), hMm: z.number().positive().max(2000), pagina: z.number().int().positive().max(99).default(1),
  zonas: z.array(Zona).max(400).default([]),
  /** Lote 14 (item 188): versão do cálculo das zonas (2 = as faixas de tinta, não a caixa inteira da marca). */
  zonasV: z.number().int().min(1).max(9).optional(),
  /** Lote 15 (item 202): ajuste fino da marca (mm) e a orientação em que foi medido. */
  ajuste: z.object({ xMm: z.number().min(-50).max(50), yMm: z.number().min(-50).max(50), paisagem: z.boolean() }).optional(),
})
type Linha = { id: string; folha_w_mm: number; folha_h_mm: number; nome_arquivo: string; sha256: string; area_livre: { nome?: string; pagina?: number; zonas?: unknown[]; zonasV?: number; ajuste?: unknown } | null }

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const ls = serialize(await prisma.$queryRaw<Linha[]>`SELECT * FROM mae_registration_presets WHERE workspace_id = ${c.workspaceId} ORDER BY criado_em`) as Linha[]
    return NextResponse.json({ marcas: ls.map(l => ({ id: l.id, nome: l.area_livre?.nome ?? l.nome_arquivo.split('/').pop(), path: l.nome_arquivo, sha256: l.sha256, wMm: l.folha_w_mm, hMm: l.folha_h_mm, pagina: l.area_livre?.pagina ?? 1, zonas: l.area_livre?.zonas ?? [], ...(l.area_livre?.zonasV ? { zonasV: l.area_livre.zonasV } : {}), ...(l.area_livre?.ajuste ? { ajuste: l.area_livre.ajuste } : {}) })) })
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
    if (!r.success) return recusa('marcas', { error: 'Marca inválida' }, 400)
    m = r.data
  } catch { return recusa('marcas', { error: 'JSON inválido' }, 400) }
  try {
    const dono = await prisma.$queryRaw<{ workspace_id: string }[]>`SELECT workspace_id FROM mae_registration_presets WHERE id = ${m.id}`
    if (dono.length && dono[0].workspace_id !== c.workspaceId) return recusa('marcas', { error: 'Marca de outra conta' }, 403)
    const extra = JSON.stringify({ nome: m.nome, pagina: m.pagina, zonas: m.zonas, ...(m.zonasV ? { zonasV: m.zonasV } : {}), ...(m.ajuste ? { ajuste: m.ajuste } : {}) })
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
  if (!id) return recusa('marcas', { error: 'id obrigatório' }, 400)
  try {
    await prisma.$executeRaw`DELETE FROM mae_registration_presets WHERE id = ${id} AND workspace_id = ${c.workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE MARCAS DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir a marca' }, { status: 500 })
  }
}
