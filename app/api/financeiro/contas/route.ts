// Contas bancárias / carteiras — GET (lista + saldo + flag), POST (criar / ligar módulo).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureContasBancarias, listarContas, moduloContasAtivo, setModuloContas } from '@/lib/finConta'

export const dynamic = 'force-dynamic'
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  return NextResponse.json(serialize({ modulo: await moduloContasAtivo(workspaceId), contas: await listarContas(workspaceId) }))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureContasBancarias()
  const b = await req.json().catch(() => ({}))

  // Liga/ativa o módulo de contas (aparece no menu).
  if (b.acao === 'modulo') {
    await setModuloContas(workspaceId, b.ativo !== false)
    return NextResponse.json({ ok: true, modulo: b.ativo !== false })
  }

  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome da conta' }, { status: 400 })
  const tipo = ['CONTA_CORRENTE', 'POUPANCA', 'CARTEIRA_MKT', 'DINHEIRO'].includes(b.tipo) ? b.tipo : 'CONTA_CORRENTE'

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "FinConta" ("id","workspaceId","nome","tipo","banco","saldoInicial","rendimento","ativo","ordem")
    VALUES (${id}, ${workspaceId}, ${nome}, ${tipo}, ${b.banco || null},
            ${Number(b.saldoInicial) || 0}, ${b.rendimento != null && b.rendimento !== '' ? Number(b.rendimento) : null}, true, ${Number(b.ordem) || 0})
  `
  // Ligar o módulo automaticamente ao criar a primeira conta.
  await setModuloContas(workspaceId, true)
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
