// Domínio próprio da Loja — cadastrar (POST) / consultar (GET) / remover (DELETE).
// ADMIN, workspaceId da sessão. RAW only; serialize inline. Token Vercel só no env.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureLojaDominioSchema } from '@/lib/lojaDominio'
import { vercelAddDomain, vercelRemoveDomain, registrosDns, dominioValido } from '@/lib/vercelDomains'

export const dynamic = 'force-dynamic'

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// Domínios da própria plataforma — nunca podem ser cadastrados como "domínio próprio".
const PLATAFORMA = ['usesoa.com.br', 'vps-gestao.com.br', 'vercel.app', 'localhost']
const ehPlataforma = (d: string) => PLATAFORMA.some(p => d === p || d.endsWith('.' + p))

async function admin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session.user.workspaceId as string
}

export async function GET() {
  const workspaceId = await admin()
  if (!workspaceId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureLojaDominioSchema()
  const [row] = await prisma.$queryRaw`
    SELECT "id","workspaceId","dominio","status","instrucoesDns","verificadoEm","criadoEm"
    FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  return NextResponse.json(serialize({ dominio: row || null }))
}

export async function POST(req: Request) {
  const workspaceId = await admin()
  if (!workspaceId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureLojaDominioSchema()

  const body = await req.json().catch(() => ({}))
  const dominio = String(body?.dominio || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  if (!dominioValido(dominio)) return NextResponse.json({ error: 'Domínio inválido. Use algo como loja.suamarca.com.br' }, { status: 400 })
  if (ehPlataforma(dominio)) return NextResponse.json({ error: 'Esse domínio pertence à plataforma e não pode ser usado.' }, { status: 400 })

  // 1 domínio → 1 workspace (unique global). Não permitir sequestrar de outra loja.
  const [emUso] = await prisma.$queryRaw`
    SELECT "workspaceId" FROM "LojaDominio" WHERE "dominio" = ${dominio} LIMIT 1
  ` as any[]
  if (emUso && emUso.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Este domínio já está vinculado a outra loja.' }, { status: 409 })
  }

  // Chama a Vercel para adicionar o domínio ao projeto.
  let add
  try {
    add = await vercelAddDomain(dominio)
  } catch (e: any) {
    if (e?.message === 'CONFIG_VERCEL_AUSENTE') {
      return NextResponse.json({ error: 'O recurso de domínio próprio ainda não está habilitado. Fale com o suporte.' }, { status: 503 })
    }
    console.error('[LOJA-DOMINIO] add', e?.message)
    return NextResponse.json({ error: 'Não foi possível adicionar o domínio agora. Tente mais tarde.' }, { status: 502 })
  }
  if ('erro' in add) {
    const status = add.erro === 'DOMINIO_EM_USO' ? 409 : 502
    return NextResponse.json({ error: add.mensagem }, { status })
  }

  const registros = registrosDns(dominio, add.verification)
  const status = add.verified ? 'ATIVO' : 'PENDENTE'
  const id = novoId()

  // Upsert (1 por workspace). Se trocou de domínio, atualiza a linha existente.
  await prisma.$executeRaw`
    INSERT INTO "LojaDominio" ("id","workspaceId","dominio","status","instrucoesDns","verificadoEm","criadoEm")
    VALUES (${id}, ${workspaceId}, ${dominio}, ${status}, ${JSON.stringify(registros)}::jsonb,
            ${add.verified ? new Date() : null}, now())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "dominio" = EXCLUDED."dominio",
      "status" = EXCLUDED."status",
      "instrucoesDns" = EXCLUDED."instrucoesDns",
      "verificadoEm" = EXCLUDED."verificadoEm"
  `

  const [row] = await prisma.$queryRaw`
    SELECT "id","workspaceId","dominio","status","instrucoesDns","verificadoEm","criadoEm"
    FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  return NextResponse.json(serialize({ ok: true, dominio: row }))
}

export async function DELETE() {
  const workspaceId = await admin()
  if (!workspaceId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureLojaDominioSchema()

  const [row] = await prisma.$queryRaw`
    SELECT "dominio" FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!row) return NextResponse.json({ ok: true }) // nada a remover

  await vercelRemoveDomain(row.dominio) // best-effort na Vercel
  await prisma.$executeRaw`DELETE FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
