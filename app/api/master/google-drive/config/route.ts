// Status da conexão do Google Drive (só Master) + desconectar.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { statusConexao, desconectar } from '@/lib/googledrive'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return NextResponse.json(await statusConexao())
}

export async function DELETE(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await desconectar()
  return NextResponse.json({ ok: true })
}
