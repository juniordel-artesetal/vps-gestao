// Salvar/atualizar o walletId da própria parceira (escopo por parceiroId da sessão).
// Validação só de FORMATO (UUID) — a verdade é o 1º split. Gateado por PARCEIRAS_ATIVO.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { walletIdFormatoOk } from '@/lib/parceiras/candidatura'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  const session = await getServerSession(authOptions)
  const parceiroId = (session?.user as any)?.parceiroId
  if (!session || (session.user as any).role !== 'parceira' || !parceiroId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const b = await req.json().catch(() => ({}))
  const walletId = String(b.walletId || '').trim()
  if (!walletIdFormatoOk(walletId)) {
    return NextResponse.json({ error: 'walletId inválido — cole o identificador da sua conta Asaas (formato UUID).' }, { status: 400 })
  }

  await prisma.$executeRaw`UPDATE "Parceiro" SET "walletId" = ${walletId} WHERE "id" = ${parceiroId}`
  console.log(`[PARCEIRA] walletId atualizado parceiro=${parceiroId}`)
  return NextResponse.json({ ok: true })
}
