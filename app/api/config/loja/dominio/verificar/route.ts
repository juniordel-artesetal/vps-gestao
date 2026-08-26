// Verifica o domínio próprio: chama a Vercel (verify + config). Se o DNS aponta certo,
// marca ATIVO (SSL é emitido automaticamente pela Vercel). ADMIN, workspaceId da sessão.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureLojaDominioSchema } from '@/lib/lojaDominio'
import { vercelVerify, vercelConfig, registrosDns } from '@/lib/vercelDomains'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureLojaDominioSchema()

  const [row] = await prisma.$queryRaw`
    SELECT "dominio","status" FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!row) return NextResponse.json({ error: 'Nenhum domínio cadastrado.' }, { status: 404 })

  let verified = false, misconfigured = true, verification: any[] = []
  try {
    const v = await vercelVerify(row.dominio)
    verified = v.verified
    verification = v.verification || []
    const c = await vercelConfig(row.dominio)
    misconfigured = c.misconfigured
  } catch (e: any) {
    if (e?.message === 'CONFIG_VERCEL_AUSENTE') return NextResponse.json({ error: 'Recurso não habilitado. Fale com o suporte.' }, { status: 503 })
    console.error('[LOJA-DOMINIO] verificar', e?.message)
    return NextResponse.json({ error: 'Não foi possível verificar agora. Tente em instantes.' }, { status: 502 })
  }

  const ativo = verified && !misconfigured
  const novoStatus = ativo ? 'ATIVO' : 'VERIFICANDO'
  const registros = registrosDns(row.dominio, verification)

  await prisma.$executeRaw`
    UPDATE "LojaDominio"
    SET "status" = ${novoStatus},
        "instrucoesDns" = ${JSON.stringify(registros)}::jsonb,
        "verificadoEm" = ${ativo ? new Date() : null}
    WHERE "workspaceId" = ${workspaceId}
  `

  const [atual] = await prisma.$queryRaw`
    SELECT "id","workspaceId","dominio","status","instrucoesDns","verificadoEm","criadoEm"
    FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]

  return NextResponse.json(serialize({
    ok: true,
    ativo,
    // mensagem para a UI quando ainda não propagou
    aviso: ativo ? null : (verified ? 'O DNS ainda está propagando. Isso pode levar alguns minutos.' : 'Ainda não encontramos o registro no seu DNS. Confira os valores e tente de novo em alguns minutos (a propagação pode demorar).'),
    dominio: atual,
  }))
}
