// Master — "Ativar influenciadora": liga a cortesia + aprova a parceira, numa ação só.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ativarInfluenciadora } from '@/lib/influenciadora'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { workspaceId } = await params
  const r = await ativarInfluenciadora(workspaceId, 'master')
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })
  return NextResponse.json({ ok: true })
}
