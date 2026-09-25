// Master — cortesia dos Templates Especiais (liga/desliga sem Asaas; nunca cortada pela régua).
import { NextRequest, NextResponse } from 'next/server'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { definirCortesiaEspeciais } from '@/lib/estudio/especiais'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await ehMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const ws = String(b.workspaceId || '')
  if (!/^[\w-]{6,60}$/.test(ws)) return NextResponse.json({ error: 'workspaceId inválido' }, { status: 400 })
  await definirCortesiaEspeciais(ws, b.on !== false)
  return NextResponse.json({ ok: true })
}
