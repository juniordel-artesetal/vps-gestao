import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// ── PUT — atualizar status e/ou nota interna
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { status, notaInterna } = await req.json()

  if (status !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "status" = ${status} WHERE "id" = ${id}
    `
  }
  if (notaInterna !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "notaInterna" = ${notaInterna} WHERE "id" = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}

// ── POST — responder por e-mail via Resend
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id }        = await params
  const { mensagem }  = await req.json()

  if (!mensagem?.trim()) {
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
  }

  // Buscar dados do chamado
  const chamados = await prisma.$queryRaw`
    SELECT sc.*, w.nome AS "workspaceNome"
    FROM "SuporteChamado" sc
    LEFT JOIN "Workspace" w ON w.id = sc."workspaceId"
    WHERE sc.id = ${id}
    LIMIT 1
  ` as any[]

  if (!chamados.length) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
  const chamado = chamados[0]

  // Enviar e-mail via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'VPS Gestão Suporte <suporte@vpsgestao.com.br>',
      to:   [chamado.email],
      subject: `Re: [${chamado.protocolo}] Resposta do Suporte VPS Gestão`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f97316;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0;font-size:18px">VPS Gestão — Suporte</h2>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            <p style="color:#333;font-size:14px">Olá, <strong>${chamado.usuarioNome}</strong>!</p>
            <p style="color:#555;font-size:14px">Respondemos ao seu chamado <strong>${chamado.protocolo}</strong>:</p>
            <div style="background:#f9f9f9;border-left:3px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
              <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${mensagem}</p>
            </div>
            <p style="color:#999;font-size:12px;margin-top:24px">
              Se precisar de mais ajuda, acesse a Central de Suporte em
              <a href="https://vps-gestao.natycostapro.com.br/suporte" style="color:#f97316">vps-gestao.natycostapro.com.br/suporte</a>
            </p>
          </div>
        </div>
      `,
    }),
  })

  if (!emailRes.ok) {
    return NextResponse.json({ error: 'Erro ao enviar e-mail' }, { status: 500 })
  }

  // Atualizar status e data de resposta
  await prisma.$executeRaw`
    UPDATE "SuporteChamado"
    SET "status" = 'EM_ATENDIMENTO', "respondidoEm" = NOW()
    WHERE "id" = ${id}
  `

  return NextResponse.json({ ok: true })
}
