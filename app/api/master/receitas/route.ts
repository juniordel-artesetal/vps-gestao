// Gestão de Receitas do SOA (Master) — GET do painel. SOMENTE LEITURA do espelho local (sem chamar Asaas/Hotmart).
// Visão CROSS-TENANT (todos os workspaces): por isso não filtra workspaceId. Gate = token do Master.
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { serialize } from '@/lib/serialize'
import { painelReceitas, resolverPeriodo } from '@/lib/master/receitas'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await ehMaster(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  try {
    const periodo = resolverPeriodo(sp.get('periodo'), sp.get('de'), sp.get('ate'))
    return NextResponse.json(serialize(await painelReceitas(periodo)))
  } catch (e) {
    console.error('[MASTER RECEITAS]', (e as Error)?.message)
    return NextResponse.json({ error: 'Erro ao montar o painel de receitas' }, { status: 500 })
  }
}
