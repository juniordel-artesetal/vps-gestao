// SOA Edition — Google Drive da própria artesã: estado da conexão e desconectar (apaga os tokens).
import { NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { statusDrive, desconectar } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  return NextResponse.json(await statusDrive(c.userId))
}

export async function DELETE() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  await desconectar(c.userId)
  return NextResponse.json({ ok: true })
}
