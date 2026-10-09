// Método MAE — PRESETS DE EFEITO (mae_effect_presets): biblioteca privada da conta + Loja da Naty
// (workspace_id = 'naty', só os publicados). Um preset guarda os efeitos — nunca a fonte — e, Lote 4 (item 51),
// o papel dentro do texto ("Preencher com papel"), na coluna `textura`.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { Preset } from '@/lib/mae/efeitos/presets'
import { limparEfeitos } from '@/lib/mae/schema/efeitos'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

type Linha = { id: string; workspace_id: string; nome: string; effects: unknown; preco_centavos: number | null; gratis: boolean; textura?: unknown }
// Lote 5 (itens 74/75): fundo do texto e trocas de letra vão na MESMA coluna jsonb `textura`, num envelope
// `{ _v: 2, textura?, fundo?, trocas? }` (sem migração; o formato antigo — só a textura — continua valendo)
type Envelope = { _v?: number; textura?: unknown; fundo?: unknown; trocas?: unknown }
function extras(t: unknown): Record<string, unknown> {
  if (!t || typeof t !== 'object') return {}
  const e = t as Envelope
  if (e._v !== 2) return { textura: t }
  return { ...(e.textura ? { textura: e.textura } : {}), ...(e.fundo ? { fundo: e.fundo } : {}), ...(Array.isArray(e.trocas) && e.trocas.length ? { trocas: e.trocas } : {}) }
}
const paraPreset = (l: Linha) => ({ id: l.id, name: l.nome, effects: limparEfeitos(l.effects), owner: l.workspace_id === 'naty' ? 'naty' : 'me', free: l.gratis, ...(l.preco_centavos ? { priceCents: l.preco_centavos } : {}), ...extras(l.textura) })

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const meus = await prisma.$queryRaw<Linha[]>`SELECT * FROM mae_effect_presets WHERE workspace_id = ${c.workspaceId} ORDER BY nome`
    const naty = await prisma.$queryRaw<Linha[]>`SELECT * FROM mae_effect_presets WHERE workspace_id = 'naty' AND publicado ORDER BY nome`
    return NextResponse.json({ meus: serialize(meus).map(paraPreset), naty: serialize(naty).map(paraPreset) })
  } catch (e) {
    console.error('[MAE PRESETS GET]', e)
    return NextResponse.json({ error: 'Erro ao listar os presets' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let p
  try {
    const r = Preset.safeParse((await lerJson(req, 200_000) as { preset?: unknown })?.preset)
    if (!r.success) return NextResponse.json({ error: 'Preset inválido' }, { status: 400 })
    p = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    // a usuária só grava na própria biblioteca (nunca na Loja da Naty), e só os efeitos
    const dono = await prisma.$queryRaw<{ workspace_id: string }[]>`SELECT workspace_id FROM mae_effect_presets WHERE id = ${p.id}`
    if (dono.length && dono[0].workspace_id !== c.workspaceId) return NextResponse.json({ error: 'Preset de outra conta' }, { status: 403 })
    await prisma.$executeRaw`
      INSERT INTO mae_effect_presets (id, workspace_id, nome, effects, gratis, textura)
      VALUES (${p.id}, ${c.workspaceId}, ${p.name}, ${JSON.stringify(limparEfeitos(p.effects))}::jsonb, true, ${p.fundo || p.trocas?.length ? JSON.stringify({ _v: 2, textura: p.textura, fundo: p.fundo, trocas: p.trocas }) : p.textura ? JSON.stringify(p.textura) : null}::jsonb)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, effects = EXCLUDED.effects, textura = EXCLUDED.textura, atualizado_em = now()`
    return NextResponse.json({ ok: true, id: p.id })
  } catch (e) {
    console.error('[MAE PRESETS PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar o preset' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    await prisma.$executeRaw`DELETE FROM mae_effect_presets WHERE id = ${id} AND workspace_id = ${c.workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE PRESETS DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir o preset' }, { status: 500 })
  }
}
