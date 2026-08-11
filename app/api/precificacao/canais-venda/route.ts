// Canais de venda do WORKSPACE: lista o catálogo gerenciado + os canais que a artesã
// já habilitou/criou + os flags. Ela HABILITA um gerenciado (com ajuste opcional) ou
// cadastra um CUSTOM. Flags (moduloCanais / canaisLancaFinanceiro) também aqui.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import {
  getCatalogoCanais, listarCanaisVenda, upsertCanalVenda, removerCanalVenda,
  flagsCanais, ensureCanalVendaTable, avisoResponsabilidade,
  resolverTaxa, calcularLiquido, valorTaxa,
} from '@/lib/canaisVenda'

export const dynamic = 'force-dynamic'

async function ws(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.workspaceId ?? null
}

export async function GET(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const [catalogo, canais, flags] = await Promise.all([
    getCatalogoCanais(), listarCanaisVenda(workspaceId), flagsCanais(workspaceId),
  ])

  // Simulação de "quanto sobra por canal": ?preco= (e opcional ?custo=). A taxa efetiva
  // é resolvida no servidor (respeita faixa de preço / categoria / ajuste da artesã).
  const preco = Number(new URL(req.url).searchParams.get('preco') || 0)
  const custo = Number(new URL(req.url).searchParams.get('custo') || 0)
  let simulacao: unknown[] = []
  if (preco > 0) {
    simulacao = await Promise.all(canais.map(async (c) => {
      const t = await resolverTaxa(workspaceId, c.canal, { preco })
      const liquido = calcularLiquido(preco, t)
      return {
        canal: c.canal, nome: c.nome, origem: t.origem, ajustado: t.ajustado ?? false,
        taxaPercent: t.taxaPercent, taxaFixa: t.taxaFixa, taxa: valorTaxa(preco, t),
        liquido, margem: custo > 0 ? Math.round((liquido - custo) / preco * 1000) / 10 : null,
        lucro: custo > 0 ? Math.round((liquido - custo) * 100) / 100 : null,
        atualizadoEm: t.atualizadoEm,
      }
    }))
  }
  return NextResponse.json(serialize({ catalogo, canais, flags, aviso: avisoResponsabilidade(), simulacao }))
}

// PUT — habilita/edita um canal (gerenciado com ajuste OU custom).
export async function PUT(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.canal && b.origem !== 'custom') return NextResponse.json({ error: 'canal é obrigatório' }, { status: 400 })
  if (b.origem === 'custom' && !String(b.nome || '').trim()) return NextResponse.json({ error: 'Dê um nome à sua plataforma' }, { status: 400 })
  await upsertCanalVenda(workspaceId, {
    canal: String(b.canal || b.nome), nome: b.nome, origem: b.origem === 'custom' ? 'custom' : 'gerenciado',
    categoria: b.categoria ?? null, variante: b.variante ?? null,
    overridePercent: b.overridePercent === '' || b.overridePercent == null ? null : Number(b.overridePercent),
    overrideFixa: b.overrideFixa === '' || b.overrideFixa == null ? null : Number(b.overrideFixa),
    taxaPercent: b.taxaPercent == null ? undefined : Number(b.taxaPercent),
    taxaFixa: b.taxaFixa == null ? undefined : Number(b.taxaFixa),
    pixDias: b.pixDias == null ? undefined : Number(b.pixDias),
    cartaoDias: b.cartaoDias == null ? undefined : Number(b.cartaoDias),
  })
  return NextResponse.json(serialize({ ok: true, canais: await listarCanaisVenda(workspaceId) }))
}

// DELETE ?canal=slug — desabilita um canal do workspace.
export async function DELETE(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const canal = new URL(req.url).searchParams.get('canal')
  if (!canal) return NextResponse.json({ error: 'canal é obrigatório' }, { status: 400 })
  await removerCanalVenda(workspaceId, canal)
  return NextResponse.json(serialize({ ok: true, canais: await listarCanaisVenda(workspaceId) }))
}

// POST { acao:'flags', moduloCanais?, canaisLancaFinanceiro? } — liga/desliga a feature.
export async function POST(req: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (b.acao !== 'flags') return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  await ensureCanalVendaTable()
  await prisma.$executeRaw`
    UPDATE "Workspace" SET
      "moduloCanais" = COALESCE(${b.moduloCanais == null ? null : !!b.moduloCanais}::boolean, "moduloCanais"),
      "canaisLancaFinanceiro" = COALESCE(${b.canaisLancaFinanceiro == null ? null : !!b.canaisLancaFinanceiro}::boolean, "canaisLancaFinanceiro"),
      "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}
  `
  return NextResponse.json(serialize({ ok: true, flags: await flagsCanais(workspaceId) }))
}
