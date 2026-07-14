import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Serve o anexo (print) de um ticket por uma URL própria — funciona nos DOIS lados (assinante
// e atendente) e abre em tamanho cheio (data: URI não abre em nova aba nos navegadores).
// ★LGPD/segurança: só as PARTES do ticket veem o anexo — o atendente (master_token) OU a
// assinante do MESMO workspace do chamado/feedback. NUNCA expõe anexo de outro workspace.
// fonte=msg (SuporteMensagem) | chamado (SuporteChamado) | feedback (SuporteFeedback).

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Resolve o data-URI do anexo + o workspaceId dono (para autorizar).
async function carregarAnexo(fonte: string, id: string): Promise<{ imagem: string | null; workspaceId: string | null } | null> {
  if (fonte === 'chamado') {
    const [r] = await prisma.$queryRaw`SELECT "imagem", "workspaceId" FROM "SuporteChamado" WHERE "id" = ${id} LIMIT 1` as any[]
    return r ? { imagem: r.imagem, workspaceId: r.workspaceId } : null
  }
  if (fonte === 'feedback') {
    const [r] = await prisma.$queryRaw`SELECT "imagem", "workspaceId" FROM "SuporteFeedback" WHERE "id" = ${id} LIMIT 1` as any[]
    return r ? { imagem: r.imagem, workspaceId: r.workspaceId } : null
  }
  // msg (padrão): resolve o workspace pelo chamado/feedback de referência
  const [m] = await prisma.$queryRaw`SELECT "imagem", "referenciaId", "tipo" FROM "SuporteMensagem" WHERE "id" = ${id} LIMIT 1` as any[]
  if (!m) return null
  let workspaceId: string | null = null
  if (m.referenciaId) {
    const tabela = m.tipo === 'FEEDBACK' ? 'SuporteFeedback' : 'SuporteChamado'
    const [ref] = await prisma.$queryRawUnsafe(`SELECT "workspaceId" FROM "${tabela}" WHERE "id" = $1 LIMIT 1`, m.referenciaId) as any[]
    workspaceId = ref?.workspaceId ?? null
  }
  return { imagem: m.imagem, workspaceId }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const fonte = new URL(req.url).searchParams.get('fonte') || 'msg'

    const dado = await carregarAnexo(fonte, id)
    if (!dado || !dado.imagem) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })

    // Autorização: atendente (master) OU assinante do MESMO workspace do ticket.
    const master = await ehMaster()
    if (!master) {
      const session = await getServerSession(authOptions)
      if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      if (!dado.workspaceId || dado.workspaceId !== session.user.workspaceId)
        return NextResponse.json({ error: 'Sem acesso a este anexo' }, { status: 403 })
    }

    // Decodifica o data URI (data:image/png;base64,....) e devolve como imagem de verdade.
    const raw = String(dado.imagem)
    const virgula = raw.indexOf(',')
    const meta = virgula > 0 ? raw.slice(0, virgula) : ''
    const mimeMatch = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/)
    if (virgula < 0 || !mimeMatch) {
      // Anexo legado que não é data-URI (ex.: já é uma URL http) — redireciona.
      if (/^https?:\/\//.test(raw)) return NextResponse.redirect(raw)
      return NextResponse.json({ error: 'Formato de anexo inválido' }, { status: 415 })
    }
    const buffer = Buffer.from(raw.slice(virgula + 1), 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMatch[1],
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('[SUPORTE ANEXO]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
