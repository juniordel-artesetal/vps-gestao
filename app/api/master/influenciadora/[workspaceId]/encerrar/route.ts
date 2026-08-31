// Master — "Encerrar cortesia": desliga o acesso gratuito (14d de carência). Parceria continua.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encerrarCortesia } from '@/lib/influenciadora'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { workspaceId } = await params
  const b = await req.json().catch(() => ({}))
  const r = await encerrarCortesia(workspaceId, b?.motivo ?? null, 'master')
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })
  return NextResponse.json({ ok: true })
}
