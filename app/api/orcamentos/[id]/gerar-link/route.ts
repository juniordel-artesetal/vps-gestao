import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { baseUrlDeHeaders } from '@/lib/baseUrl'
import { randomBytes } from 'crypto'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [orc] = await prisma.$queryRaw`
      SELECT o."id", o."titulo", o."clienteNome", w."nome" AS "workspaceNome"
      FROM "Orcamento" o
      JOIN "Workspace" w ON w."id" = o."workspaceId"
      WHERE o."id" = ${id} AND o."workspaceId" = ${workspaceId}
    ` as any[]

    if (!orc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Gerar token único
    const token = randomBytes(24).toString('hex')

    await prisma.$executeRaw`
      UPDATE "Orcamento" SET "tokenAprovacao" = ${token}, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const baseUrl = baseUrlDeHeaders(req.headers)
    const link = `${baseUrl}/orcamento/${token}`

    // Mensagem pronta pra WhatsApp (saudação + link)
    const primeiroNome = String(orc.clienteNome || '').trim().split(/\s+/)[0] || ''
    const oQue = orc.titulo ? `o orçamento "${orc.titulo}"` : 'seu orçamento'
    const assina = orc.workspaceNome ? `\n\n${orc.workspaceNome} 💛` : ''
    const mensagem = `Oi${primeiroNome ? ' ' + primeiroNome : ''}! 💛 ${orc.titulo ? oQue.charAt(0).toUpperCase() + oQue.slice(1) : 'Seu orçamento'} está pronto. É só abrir aqui pra ver os detalhes e aprovar:\n${link}${assina}`

    return NextResponse.json({ token, link, mensagem })
  } catch (error) {
    console.error('POST gerar-link:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
