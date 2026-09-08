// Cancelar/encerrar um chamado que a própria artesã abriu (sugestão OJ22).
// Só os chamados do workspace dela; idempotente; registra quem/quando (+ motivo opcional).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

let auditOk = false
async function garantirColunasAudit() {
  if (auditOk) return
  const [pronto] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='SuporteChamado' AND column_name='canceladoEm') AS ok
  `) as { ok: boolean }[]
  if (pronto?.ok) { auditOk = true; return }
  await prisma.$executeRawUnsafe(`ALTER TABLE "SuporteChamado" ADD COLUMN IF NOT EXISTS "canceladoEm" TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "SuporteChamado" ADD COLUMN IF NOT EXISTS "canceladoPor" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "SuporteChamado" ADD COLUMN IF NOT EXISTS "canceladoMotivo" TEXT`)
  auditOk = true
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const acao = body?.acao
  if (acao !== 'cancelar') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  await garantirColunasAudit()
  const motivo = String(body?.motivo ?? '').trim().slice(0, 500) || null
  const quem = session.user.name ?? session.user.email ?? 'Usuária'

  // Idempotente: só cancela se ainda estiver aberto/em atendimento (não mexe em RESOLVIDO/CANCELADO).
  // O guard por workspaceId garante que só cancela um chamado da própria conta.
  const n = await prisma.$executeRaw`
    UPDATE "SuporteChamado"
    SET "status" = 'CANCELADO', "canceladoEm" = NOW(), "canceladoPor" = ${quem}, "canceladoMotivo" = ${motivo}
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} AND "status" IN ('ABERTO', 'EM_ATENDIMENTO')
  `
  if (Number(n) === 0) {
    const [existe] = await prisma.$queryRaw`
      SELECT "status" FROM "SuporteChamado" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as { status: string }[]
    if (!existe) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    // Já cancelado/resolvido → idempotente (não erra).
    return NextResponse.json({ ok: true, status: existe.status, jaFinalizado: true })
  }
  return NextResponse.json({ ok: true, status: 'CANCELADO' })
}
