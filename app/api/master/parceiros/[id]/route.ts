// Master — aprovar / recusar uma candidatura de parceira. Guarda master.
//   POST { acao: 'aprovar'|'recusar', codigo? }   (codigo: ajuste opcional na aprovação)
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { aprovarParceira, recusarParceira } from '@/lib/parceiras/candidatura'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const r = b.acao === 'recusar'
    ? await recusarParceira(id, 'master')
    : b.acao === 'aprovar'
      ? await aprovarParceira(id, { codigo: b.codigo, aprovadoPor: 'master' })
      : { ok: false, erro: 'Ação inválida (aprovar|recusar).' }

  if (!r.ok) return NextResponse.json({ error: r.erro, campo: r.campo }, { status: 400 })
  return NextResponse.json({ ok: true })
}
