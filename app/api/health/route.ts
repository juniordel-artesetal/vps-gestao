// app/api/health/route.ts
// Healthcheck — usado pelo cron Vercel para manter conexão Neon aquecida
// Evita que o banco entre em modo idle e cause P1001 nos usuários

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const t0 = Date.now()
  try {
    const r = await prisma.$queryRaw`SELECT 1 AS ok` as any[]
    return NextResponse.json({
      ok: true,
      db: r[0]?.ok === 1,
      latency_ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[health] erro:', err?.message || err)
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
      latency_ms: Date.now() - t0,
    }, { status: 503 })
  }
}
