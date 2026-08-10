import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { setParceiroSessao } from '@/lib/parceiros/auth'

export const dynamic = 'force-dynamic'

// POST — login do PORTAL DO PARCEIRO (separado da artesã/Master).
// body: { email, senha }. senhaHash nunca sai; erro genérico (não revela se e-mail existe).
export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json().catch(() => ({}))
    const e = String(email || '').trim().toLowerCase()
    if (!e || !senha) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })

    const [row] = await prisma.$queryRaw`
      SELECT pa."parceiroId", pa."senhaHash", p."ativo"
      FROM "ParceiroAuth" pa
      JOIN "Parceiro" p ON p."id" = pa."parceiroId"
      WHERE pa."email" = ${e} LIMIT 1
    ` as any[]

    const ok = row && row.ativo && await bcrypt.compare(String(senha), row.senhaHash)
    if (!ok) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    await setParceiroSessao(row.parceiroId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PARCEIRO] login:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
