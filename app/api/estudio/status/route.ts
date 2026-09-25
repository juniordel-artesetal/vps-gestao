// SOA Edition — estado do ambiente para a UI (ex.: armazenamento configurado?).
import { NextResponse } from 'next/server'
import { ctxEstudio, storageConfigurado } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  return NextResponse.json({ storage: storageConfigurado() })
}
