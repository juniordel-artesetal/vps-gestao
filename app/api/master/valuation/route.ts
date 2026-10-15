// Valuation da Empresa (Master → Receitas) — estimativa ao vivo pelos números reais. SOMENTE LEITURA, gate do Master.
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { serialize } from '@/lib/serialize'
import { valuationAtual } from '@/lib/master/valuationDados'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await ehMaster(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json(serialize(await valuationAtual()))
  } catch (e) {
    console.error('[MASTER VALUATION]', (e as Error)?.message)
    return NextResponse.json({ error: 'Erro ao calcular o valuation' }, { status: 500 })
  }
}
