import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const PROVEDORES = ['mercadopago']

// GET — config de pagamento. NUNCA retorna a credencial (só um booleano).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const [cfg] = await prisma.$queryRaw`
    SELECT "pixChave","pixNome","pixCidade","linkPagamento","provedor",
           "provedorAtivo","metodos",
           ("credencial" IS NOT NULL AND "credencial" <> '') AS "temCredencial"
    FROM "LojaPagamentoConfig" WHERE "workspaceId" = ${session.user.workspaceId}
  ` as any[]

  return NextResponse.json({ config: cfg || null })
}

// PUT — salva config de pagamento (credencial só é alterada quando enviada)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const pixChave = body.pixChave ? String(body.pixChave).trim() : null
  const pixNome = body.pixNome ? String(body.pixNome).trim() : null
  const pixCidade = body.pixCidade ? String(body.pixCidade).trim() : null
  const linkPagamento = body.linkPagamento ? String(body.linkPagamento).trim() : null
  const provedor = PROVEDORES.includes(body.provedor) ? body.provedor : null
  const provedorAtivo = Boolean(body.provedorAtivo)
  const metodos = Array.isArray(body.metodos) ? JSON.stringify(body.metodos.filter((m: string) => ['pix', 'link', 'mercadopago'].includes(m))) : null

  // Upsert dos campos não-sensíveis
  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "LojaPagamentoConfig"
      ("id","workspaceId","pixChave","pixNome","pixCidade","linkPagamento","provedor","provedorAtivo","metodos","createdAt","updatedAt")
    VALUES (${id}, ${workspaceId}, ${pixChave}, ${pixNome}, ${pixCidade}, ${linkPagamento}, ${provedor}, ${provedorAtivo}, ${metodos}, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "pixChave" = ${pixChave}, "pixNome" = ${pixNome}, "pixCidade" = ${pixCidade},
      "linkPagamento" = ${linkPagamento}, "provedor" = ${provedor},
      "provedorAtivo" = ${provedorAtivo}, "metodos" = ${metodos}, "updatedAt" = NOW()
  `

  // Credencial: só grava quando enviada e não-vazia (evita apagar sem querer).
  // String vazia explícita ('') = remover.
  if (body.credencial !== undefined) {
    const cred = body.credencial ? String(body.credencial).trim() : null
    await prisma.$executeRaw`
      UPDATE "LojaPagamentoConfig" SET "credencial" = ${cred}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId}
    `
  }

  return NextResponse.json({ ok: true })
}
