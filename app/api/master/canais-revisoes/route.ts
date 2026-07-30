// Master — lista e resolve as revisões de taxa de canal (alertas do monitoramento).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serialize } from '@/lib/serialize'
import { listarRevisoes, resolverRevisao, verificarCanais, atualizarUrlFonte } from '@/lib/canaisMonitor'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-master-token')
  if (headerToken) return headerToken === process.env.MASTER_SECRET_TOKEN
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — revisões (default: pendentes) + estado dos monitores (verificado em / status)
export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const status = new URL(req.url).searchParams.get('status') || 'pendente'
  const dados = await listarRevisoes(status)
  return NextResponse.json(serialize(dados))
}

// POST — { acao:'resolver', id } | { acao:'verificarAgora', simular? }
export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  if (body.acao === 'resolver') {
    if (!body.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const ok = await resolverRevisao(String(body.id), 'master')
    return NextResponse.json({ ok })
  }
  if (body.acao === 'verificarAgora') {
    // Master roda a verificação sob demanda (grava alertas de verdade).
    const r = await verificarCanais({ dryRun: false, simular: body.simular ? String(body.simular) : null })
    return NextResponse.json(serialize({ ok: true, ...r }))
  }
  if (body.acao === 'salvarUrl') {
    if (!body.canal || !body.url) return NextResponse.json({ error: 'canal e url obrigatórios' }, { status: 400 })
    const ok = await atualizarUrlFonte(String(body.canal), String(body.url))
    return NextResponse.json({ ok, erro: ok ? undefined : 'URL inválida (use http/https).' })
  }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
