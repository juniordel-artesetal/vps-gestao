import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { creditar, MotivoMovimento } from '@/lib/creditos'

export const dynamic = 'force-dynamic'

// Protegido para MÁQUINA (webhook de pagamento) e Master:
// aceita header x-master-token OU cookie master_token, ambos contra MASTER_SECRET_TOKEN.
async function autorizado(req: NextRequest): Promise<boolean> {
  const segredo = process.env.MASTER_SECRET_TOKEN
  if (!segredo) return false
  const header = req.headers.get('x-master-token')
  if (header && header === segredo) return true
  const c = await cookies()
  return c.get('master_token')?.value === segredo
}

// POST — credita um pacote no workspace (compra via webhook Asaas amanhã, ou grant do Master).
// body: { workspaceId, tipo, qtd, motivo?, referencia? }
export async function POST(req: NextRequest) {
  try {
    if (!await autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const workspaceId = String(body.workspaceId || '').trim()
    const tipo = String(body.tipo || '').trim()
    const qtd = Number(body.qtd) || 0
    const motivo = (body.motivo as MotivoMovimento) || 'compra'
    const referencia = body.referencia ? String(body.referencia) : null

    if (!workspaceId || !tipo) return NextResponse.json({ error: 'workspaceId e tipo obrigatórios' }, { status: 400 })
    if (qtd <= 0) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })

    const r = await creditar({ workspaceId, tipo, qtd, motivo, referencia })
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json(r)
  } catch (error) {
    console.error('[CREDITOS] grant:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
