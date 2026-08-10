import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { credenciaisConfiguradas } from '@/lib/logistica'
import { getConfigPublica, salvarRemetente, desconectar, moduloPostagemAtivo } from '@/lib/logistica/config'

export const dynamic = 'force-dynamic'

// GET — status da conexão + remetente + se as credenciais existem no servidor. NUNCA tokens.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId

  const [cfg, moduloAtivo] = await Promise.all([
    getConfigPublica(workspaceId),
    moduloPostagemAtivo(workspaceId),
  ])
  return NextResponse.json(serialize({
    moduloPostagem: moduloAtivo,
    credenciaisServidor: credenciaisConfiguradas(),
    config: cfg || {
      provedor: 'melhorenvio', conectado: false,
      remetenteNome: null, remetenteDoc: null, cepOrigem: null,
      logradouroOrigem: null, numeroOrigem: null, bairroOrigem: null,
      cidadeOrigem: null, ufOrigem: null, tokenExpiraEm: null,
    },
  }))
}

// PUT — salva remetente e/ou liga/desliga o módulo. ADMIN only.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))

  if (typeof b.moduloPostagem === 'boolean') {
    await prisma.$executeRaw`UPDATE "Workspace" SET "moduloPostagem" = ${b.moduloPostagem} WHERE "id" = ${workspaceId}`
  }

  if (b.remetente) {
    const r = b.remetente
    await salvarRemetente(workspaceId, {
      remetenteNome: r.remetenteNome ?? null,
      remetenteDoc: r.remetenteDoc ?? null,
      cepOrigem: r.cepOrigem ? String(r.cepOrigem).replace(/\D/g, '') : null,
      logradouroOrigem: r.logradouroOrigem ?? null,
      numeroOrigem: r.numeroOrigem ?? null,
      bairroOrigem: r.bairroOrigem ?? null,
      cidadeOrigem: r.cidadeOrigem ?? null,
      ufOrigem: r.ufOrigem ? String(r.ufOrigem).toUpperCase().slice(0, 2) : null,
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — desconecta a conta de transportadora (limpa tokens).
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await desconectar(session.user.workspaceId)
  return NextResponse.json({ ok: true })
}
