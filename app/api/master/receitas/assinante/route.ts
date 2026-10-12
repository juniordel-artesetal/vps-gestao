// Gestão de Receitas — histórico POR ASSINANTE (Master).
//   GET ?q=texto  → busca (nome, e-mail, ateliê ou id do workspace)
//   GET ?id=ws    → perfil de receita (espelho local)
//   POST {id}     → "Atualizar do gateway": puxa AO VIVO só essa pessoa (poucas chamadas). Só ajusta o ESPELHO;
//                   nenhuma cobrança/estorno/cancelamento sai daqui.
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { serialize } from '@/lib/serialize'
import { buscarAssinantes, perfilAssinante, atualizarDoGateway } from '@/lib/master/receitas'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await ehMaster(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  try {
    const id = sp.get('id')
    if (id) {
      const p = await perfilAssinante(id)
      if (!p) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
      return NextResponse.json(serialize(p))
    }
    const q = (sp.get('q') ?? '').trim()
    if (q.length < 2) return NextResponse.json({ resultados: [] })
    return NextResponse.json(serialize({ resultados: await buscarAssinantes(q.slice(0, 120)) }))
  } catch (e) {
    console.error('[MASTER RECEITAS ASSINANTE]', (e as Error)?.message)
    return NextResponse.json({ error: 'Erro ao buscar a assinante' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await ehMaster(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'Informe a conta' }, { status: 400 })
  try {
    const vivo = await atualizarDoGateway(id)
    const perfil = await perfilAssinante(id)
    return NextResponse.json(serialize({ vivo, perfil }))
  } catch (e) {
    console.error('[MASTER RECEITAS ATUALIZAR]', (e as Error)?.message)
    return NextResponse.json({ error: 'Erro ao atualizar do gateway' }, { status: 500 })
  }
}
