import { NextResponse } from 'next/server'
import { limparParceiroSessao } from '@/lib/parceiros/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  await limparParceiroSessao()
  return NextResponse.json({ ok: true })
}
