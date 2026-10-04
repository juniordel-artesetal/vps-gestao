// Método MAE — LOJA DA NATY (Sprint 12): packs de tema (mae_themes da conta 'naty', publicados) e presets
// de efeito (mae_effect_presets 'naty'), com preço e se a conta já tem (grátis ou comprado). A lista não
// traz os links dos arquivos: esses só saem em /api/mae/loja/pack/[id] para quem tem o pack.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae } from '@/lib/mae/servidor/acesso'

export const dynamic = 'force-dynamic'

type LinhaPack = { id: string; version: number; nome: string; loja: { precoCentavos?: number | null; descricao?: string; partes?: Record<string, string>; arquivos?: unknown[] } | null }

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const packs = await prisma.$queryRaw<LinhaPack[]>`
      SELECT DISTINCT ON (id) id, version, nome, doc -> 'loja' AS loja FROM mae_themes
      WHERE workspace_id = 'naty' AND publicado ORDER BY id, version DESC`
    const presets = await prisma.$queryRaw<{ id: string; nome: string; preco_centavos: number | null; gratis: boolean }[]>`
      SELECT id, nome, preco_centavos, gratis FROM mae_effect_presets WHERE workspace_id = 'naty' AND publicado ORDER BY nome`
    const meus = await prisma.$queryRaw<{ item_tipo: string; item_id: string }[]>`
      SELECT item_tipo, item_id FROM mae_purchases WHERE workspace_id = ${c.workspaceId} AND item_tipo IN ('pack','preset')`
    const tem = (t: string, id: string) => meus.some(m => m.item_tipo === t && m.item_id === id)
    return NextResponse.json(serialize({
      packs: packs.map(p => {
        const preco = p.loja?.precoCentavos ?? null
        return { id: p.id, version: p.version, nome: p.nome, descricao: p.loja?.descricao ?? '', precoCentavos: preco, gratis: !preco, partes: Object.values(p.loja?.partes ?? {}), arquivos: (p.loja?.arquivos ?? []).length, comprado: !preco || tem('pack', p.id) }
      }),
      presets: presets.map(p => ({ id: p.id, nome: p.nome, precoCentavos: p.gratis ? null : p.preco_centavos, gratis: p.gratis || !p.preco_centavos, comprado: p.gratis || !p.preco_centavos || tem('preset', p.id) })),
    }))
  } catch (e) {
    console.error('[MAE LOJA GET]', e)
    return NextResponse.json({ error: 'Erro ao abrir a Loja' }, { status: 500 })
  }
}
